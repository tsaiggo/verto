import { execFile as execFileCallback, spawn, type ChildProcess } from "node:child_process";
import { access } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { SevereServiceError } from "webdriverio";

import { cleanupDesktopSmokeFixture } from "./fixture";

const execFile = promisify(execFileCallback);
const MAX_DIAGNOSTIC_OUTPUT = 16_384;

export type DesktopTauriDriverServiceOptions = {
  host: string;
  port: number;
  nativePort: number;
  nativeDriverPath: string;
  env?: Record<string, string>;
  startTimeout?: number;
  tauriDriverPath?: string;
  cleanupFixture?: boolean;
};

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function severeServiceError(message: string, causes: unknown[]) {
  const details = causes
    .map((cause) => (cause instanceof Error ? (cause.stack ?? cause.message) : String(cause)))
    .join("\n");
  return new SevereServiceError(details ? `${message}\n${details}` : message);
}

async function firstAccessiblePath(candidates: Array<string | undefined>): Promise<string> {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const absolute = resolve(candidate);
    try {
      await access(absolute);
      return absolute;
    } catch {
      // Try the next explicit location.
    }
  }
  throw new Error(
    "tauri-driver.exe was not found. Install it with " +
      "`cargo install tauri-driver --version 2.0.6 --locked` or set " +
      "VERTO_TAURI_DRIVER_BINARY to its absolute path."
  );
}

async function findTauriDriver(explicitPath?: string): Promise<string> {
  if (explicitPath && !isAbsolute(explicitPath)) {
    throw new Error("The configured tauri-driver path must be absolute.");
  }

  let pathMatch: string | undefined;
  try {
    const { stdout } = await execFile("where.exe", ["tauri-driver.exe"], {
      encoding: "utf8",
      timeout: 10_000,
      windowsHide: true,
    });
    pathMatch = stdout
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find(Boolean);
  } catch {
    // Fall back to Cargo's conventional per-user install directory.
  }

  const cargoHome = process.env.CARGO_HOME;
  const userProfile = process.env.USERPROFILE;
  return firstAccessiblePath([
    explicitPath,
    process.env.VERTO_TAURI_DRIVER_BINARY,
    pathMatch,
    cargoHome ? join(cargoHome, "bin", "tauri-driver.exe") : undefined,
    userProfile ? join(userProfile, ".cargo", "bin", "tauri-driver.exe") : undefined,
  ]);
}

export default class DesktopTauriDriverService {
  private readonly serviceOptions: DesktopTauriDriverServiceOptions;
  private driverProcess?: ChildProcess;
  private diagnosticOutput = "";
  private startupError?: Error;
  private stopping = false;

  constructor(options: WebdriverIO.ServiceOption) {
    this.serviceOptions = options as DesktopTauriDriverServiceOptions;
  }

  async onPrepare(): Promise<void> {
    try {
      const tauriDriverPath = await findTauriDriver(this.serviceOptions.tauriDriverPath);
      await access(this.serviceOptions.nativeDriverPath);

      const driverProcess = spawn(
        tauriDriverPath,
        [
          "--port",
          String(this.serviceOptions.port),
          "--native-port",
          String(this.serviceOptions.nativePort),
          "--native-driver",
          this.serviceOptions.nativeDriverPath,
        ],
        {
          env: { ...process.env, ...this.serviceOptions.env },
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        }
      );
      this.driverProcess = driverProcess;
      driverProcess.stdout?.on("data", (chunk: Buffer) => this.captureOutput(chunk));
      driverProcess.stderr?.on("data", (chunk: Buffer) => this.captureOutput(chunk));
      driverProcess.once("error", (error) => {
        this.startupError = error;
      });
      driverProcess.once("exit", (code, signal) => {
        if (!this.stopping) {
          this.startupError = new Error(
            `tauri-driver exited before the smoke run completed (code ${String(code)}, ` +
              `signal ${String(signal)}).`
          );
        }
      });

      await this.waitUntilReady();
    } catch (error) {
      const failures: unknown[] = [error];
      try {
        await this.stopDriver();
      } catch (stopError) {
        failures.push(stopError);
      }
      throw severeServiceError("Could not start the desktop smoke WebDriver.", failures);
    }
  }

  async onComplete(): Promise<void> {
    const failures: unknown[] = [];
    try {
      await this.stopDriver();
    } catch (error) {
      failures.push(error);
    }
    if (this.serviceOptions.cleanupFixture) {
      try {
        await cleanupDesktopSmokeFixture();
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw severeServiceError("Desktop smoke teardown was incomplete.", failures);
    }
  }

  private captureOutput(chunk: Buffer): void {
    this.diagnosticOutput = `${this.diagnosticOutput}${chunk.toString("utf8")}`.slice(
      -MAX_DIAGNOSTIC_OUTPUT
    );
  }

  private async waitUntilReady(): Promise<void> {
    const timeout = this.serviceOptions.startTimeout ?? 60_000;
    const deadline = Date.now() + timeout;
    const statusUrl = `http://${this.serviceOptions.host}:${this.serviceOptions.port}/status`;

    while (Date.now() < deadline) {
      if (this.startupError) {
        throw new Error(this.withDiagnostics(this.startupError.message), {
          cause: this.startupError,
        });
      }

      try {
        const response = await fetch(statusUrl, {
          signal: AbortSignal.timeout(2_000),
        });
        if (response.ok) {
          const status = (await response.json()) as {
            value?: { ready?: boolean };
          };
          if (status.value?.ready === true) return;
        }
      } catch {
        // The driver may still be starting.
      }
      await wait(100);
    }

    throw new Error(
      this.withDiagnostics(`tauri-driver did not become ready at ${statusUrl} within ${timeout}ms.`)
    );
  }

  private withDiagnostics(message: string): string {
    const output = this.diagnosticOutput.trim();
    return output ? `${message}\nDriver output:\n${output}` : message;
  }

  private async stopDriver(): Promise<void> {
    const driverProcess = this.driverProcess;
    const pid = driverProcess?.pid;
    if (!driverProcess || !pid || driverProcess.exitCode !== null) return;

    this.stopping = true;
    try {
      await execFile("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
        encoding: "utf8",
        timeout: 15_000,
        windowsHide: true,
      });
    } catch (error) {
      if (driverProcess.exitCode === null) {
        driverProcess.kill("SIGKILL");
        throw new Error(`Could not terminate the tauri-driver process tree for PID ${pid}.`, {
          cause: error,
        });
      }
    } finally {
      this.driverProcess = undefined;
    }
  }
}
