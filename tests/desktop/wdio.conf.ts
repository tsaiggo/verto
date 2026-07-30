import { access } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import type {} from "webdriverio";
import { SevereServiceError } from "webdriverio";

import {
  desktopSmokeLocalData,
  desktopSmokeRoamingData,
  desktopSmokeUsesProductionProfile,
  desktopSmokeWebViewData,
  prepareDesktopSmokeFixture,
} from "./fixture";
import DesktopTauriDriverService from "./tauri-driver-service";

export const desktopSmokeTauriConfig = resolve("tests/desktop/tauri.smoke.conf.json");
export const desktopSmokeTargetDirectory = resolve("src-tauri/target/desktop-smoke");
export const desktopSmokeExpectedAppBinary = join(
  desktopSmokeTargetDirectory,
  "release",
  "verto.exe"
);
const requestedAppBinary = resolve(
  process.env.VERTO_DESKTOP_APP_BINARY ?? desktopSmokeExpectedAppBinary
);
if (
  !desktopSmokeUsesProductionProfile &&
  requestedAppBinary.toLowerCase() !== desktopSmokeExpectedAppBinary.toLowerCase()
) {
  throw new Error(
    "VERTO_DESKTOP_APP_BINARY must point to the isolated smoke-identifier release build."
  );
}
export const desktopAppBinary = requestedAppBinary;
export const desktopSmokeSpec = resolve("tests/desktop/vault-smoke.spec.ts");
export const desktopSmokeEdgeDriver = resolve(
  ".cache",
  "desktop-smoke",
  "edge-driver",
  "msedgedriver.exe"
);
export const desktopSmokeEdgeDriverDirectory = dirname(desktopSmokeEdgeDriver);
export const desktopSmokeDriverHost = "127.0.0.1";
export const desktopSmokeDriverPort = 4444;
export const desktopSmokeNativeDriverPort = 4445;
const deferDesktopSmokeCleanup = process.env.VERTO_DESKTOP_SMOKE_DEFER_CLEANUP === "1";
if (
  deferDesktopSmokeCleanup &&
  (!desktopSmokeUsesProductionProfile ||
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.CI !== "true")
) {
  throw new Error(
    "Desktop smoke cleanup may be deferred only for the production-profile GitHub Actions installer gate."
  );
}

export const desktopSmokeEnvironment = {
  // These protect child tools that honor environment overrides. Tauri itself
  // uses Windows Known Folders, so the smoke-only compiled identifier and the
  // guarded native profile in fixture.ts are the primary isolation boundary.
  APPDATA: desktopSmokeRoamingData,
  LOCALAPPDATA: desktopSmokeLocalData,
  WEBVIEW2_USER_DATA_FOLDER: desktopSmokeWebViewData,
  VERTO_DESKTOP_SMOKE: "1",
};

const tauriCapability = {
  "tauri:options": {
    application: desktopAppBinary,
    // tauri-driver forwards this to ms:edgeOptions.webviewOptions. Keep it
    // aligned with WEBVIEW2_USER_DATA_FOLDER so EdgeDriver watches the same
    // profile for DevToolsActivePort that the WebView2 runtime actually uses.
    webviewOptions: {
      userDataFolder: desktopSmokeWebViewData,
    },
  },
} satisfies WebdriverIO.Capabilities & {
  "tauri:options": {
    application: string;
    webviewOptions: {
      userDataFolder: string;
    };
  };
};

async function assertPortAvailable(port: number): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.unref();
    server.once("error", (error) => {
      rejectPromise(
        new Error(
          `Desktop smoke requires ${desktopSmokeDriverHost}:${port}, but that port is unavailable.`,
          { cause: error }
        )
      );
    });
    server.listen({ host: desktopSmokeDriverHost, port, exclusive: true }, () =>
      server.close((error) => (error ? rejectPromise(error) : resolvePromise()))
    );
  });
}

export const config: WebdriverIO.Config = {
  runner: "local",
  // The capability intentionally has no synthetic browserName. These top-level
  // connection settings tell WDIO that a repository-managed external driver
  // will handle the Tauri capability.
  hostname: desktopSmokeDriverHost,
  port: desktopSmokeDriverPort,
  specs: [desktopSmokeSpec],
  maxInstances: 1,
  capabilities: [tauriCapability] as WebdriverIO.Config["capabilities"],
  services: [
    [
      DesktopTauriDriverService,
      {
        host: desktopSmokeDriverHost,
        port: desktopSmokeDriverPort,
        nativePort: desktopSmokeNativeDriverPort,
        nativeDriverPath: desktopSmokeEdgeDriver,
        startTimeout: 60_000,
        env: desktopSmokeEnvironment,
        cleanupFixture: !deferDesktopSmokeCleanup,
      },
    ],
  ],
  framework: "mocha",
  reporters: ["spec"],
  outputDir: resolve("test-results/desktop-smoke"),
  logLevel: "info",
  bail: 0,
  waitforTimeout: 25_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 2,
  mochaOpts: {
    ui: "bdd",
    timeout: 120_000,
  },
  onPrepare: async () => {
    try {
      await Promise.all([access(desktopAppBinary), access(desktopSmokeEdgeDriver)]);
      await Promise.all([
        assertPortAvailable(desktopSmokeDriverPort),
        assertPortAvailable(desktopSmokeNativeDriverPort),
      ]);
      await prepareDesktopSmokeFixture();
    } catch (error) {
      const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
      throw new SevereServiceError(`Could not prepare the desktop smoke fixture.\n${detail}`);
    }
  },
};
