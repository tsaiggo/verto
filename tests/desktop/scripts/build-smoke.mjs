import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const tauriCli = resolve(repoRoot, "node_modules", "@tauri-apps", "cli", "tauri.js");
const smokeConfig = resolve(repoRoot, "tests", "desktop", "tauri.smoke.conf.json");
const smokeTarget = resolve(repoRoot, "src-tauri", "target", "desktop-smoke");

await Promise.all([access(tauriCli), access(smokeConfig)]);

const child = spawn(
  process.execPath,
  [tauriCli, "build", "--ci", "--no-bundle", "--config", smokeConfig],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      CARGO_TARGET_DIR: smokeTarget,
    },
    stdio: "inherit",
  }
);

const exitCode = await new Promise((resolveExit, rejectExit) => {
  child.once("error", rejectExit);
  child.once("exit", (code, signal) => {
    if (signal) {
      rejectExit(new Error(`Desktop smoke build stopped by ${signal}.`));
      return;
    }
    resolveExit(code);
  });
});

if (exitCode !== 0) {
  throw new Error(`Desktop smoke build exited with code ${exitCode ?? "unknown"}.`);
}
