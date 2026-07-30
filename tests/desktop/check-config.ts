import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

import DesktopTauriDriverService from "./tauri-driver-service";
import {
  config,
  desktopAppBinary,
  desktopSmokeDriverHost,
  desktopSmokeDriverPort,
  desktopSmokeEdgeDriver,
  desktopSmokeEdgeDriverDirectory,
  desktopSmokeEnvironment,
  desktopSmokeExpectedAppBinary,
  desktopSmokeNativeDriverPort,
  desktopSmokeSpec,
  desktopSmokeTargetDirectory,
  desktopSmokeTauriConfig,
} from "./wdio.conf";
import {
  DESKTOP_SMOKE_APP_IDENTIFIER,
  DESKTOP_SMOKE_ISOLATED_IDENTIFIER,
  desktopSmokeBase,
  desktopSmokeBookmarks,
  desktopSmokeDocument,
  desktopSmokeLocalData,
  desktopSmokeNativeLocalData,
  desktopSmokeNativeRoamingData,
  desktopSmokeRenamedDocument,
  desktopSmokeRoamingData,
  desktopSmokeRoot,
  desktopSmokeRunId,
  desktopSmokeUsesProductionProfile,
  desktopSmokeVault,
  desktopSmokeWatchedDocument,
  desktopSmokeWebViewData,
  isStrictChildPath,
  validateDesktopSmokeRunId,
} from "./fixture";

const failures: string[] = [];
const smokeTauriConfig = JSON.parse(readFileSync(desktopSmokeTauriConfig, "utf8")) as {
  productName?: unknown;
  identifier?: unknown;
  bundle?: { active?: unknown; createUpdaterArtifacts?: unknown };
  plugins?: { updater?: { active?: unknown } };
};
const packageManifest = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
  name?: unknown;
  version?: unknown;
};
const packageLock = JSON.parse(readFileSync(resolve("package-lock.json"), "utf8")) as {
  name?: unknown;
  version?: unknown;
  packages?: Record<string, { name?: unknown; version?: unknown }>;
};
const cargoManifest = readFileSync(resolve("src-tauri", "Cargo.toml"), "utf8");
const cargoLock = readFileSync(resolve("src-tauri", "Cargo.lock"), "utf8");
const tauriConfig = JSON.parse(readFileSync(resolve("src-tauri", "tauri.conf.json"), "utf8")) as {
  version?: unknown;
};
const cargoVersion = cargoManifest.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"$/m)?.[1];
const cargoLockVersion = cargoLock.match(
  /^\[\[package\]\]\r?\nname = "verto"\r?\nversion = "([^"]+)"$/m
)?.[1];

function expectRejectedRunId(value: string): void {
  try {
    validateDesktopSmokeRunId(value);
    failures.push(`unsafe run id was accepted: ${JSON.stringify(value)}`);
  } catch {
    // Expected: hostile path input must fail before any filesystem operation.
  }
}

if (!isAbsolute(desktopAppBinary)) failures.push("app binary path is not absolute");
if (
  !desktopSmokeUsesProductionProfile &&
  desktopAppBinary.toLowerCase() !== desktopSmokeExpectedAppBinary.toLowerCase()
) {
  failures.push("app binary is not the isolated smoke-identifier release target");
}
if (
  !desktopSmokeUsesProductionProfile &&
  dirname(dirname(desktopAppBinary)) !== desktopSmokeTargetDirectory
) {
  failures.push("app binary escapes the dedicated desktop smoke Cargo target");
}
if (!isAbsolute(desktopSmokeSpec) || !existsSync(desktopSmokeSpec)) {
  failures.push("desktop smoke spec path is missing or not absolute");
}
if (!isAbsolute(desktopSmokeTauriConfig) || !existsSync(desktopSmokeTauriConfig)) {
  failures.push("smoke-only Tauri config is missing or not absolute");
}
if (smokeTauriConfig.identifier !== DESKTOP_SMOKE_ISOLATED_IDENTIFIER) {
  failures.push("Tauri smoke config does not use the dedicated non-production identifier");
}
if (smokeTauriConfig.productName !== "Verto Smoke") {
  failures.push("Tauri smoke config does not use the smoke-only product name");
}
if (
  smokeTauriConfig.bundle?.active !== false ||
  smokeTauriConfig.bundle.createUpdaterArtifacts !== false ||
  smokeTauriConfig.plugins?.updater?.active !== false
) {
  failures.push("Tauri smoke config must disable bundling and updating");
}
if (
  typeof packageManifest.version !== "string" ||
  packageManifest.name !== "verto" ||
  packageLock.name !== "verto" ||
  packageLock.version !== packageManifest.version ||
  packageLock.packages?.[""]?.name !== "verto" ||
  packageLock.packages[""].version !== packageManifest.version ||
  cargoVersion !== packageManifest.version ||
  cargoLockVersion !== packageManifest.version
) {
  failures.push("package.json, package-lock.json, Cargo.toml, and Cargo.lock versions must match");
}
if (tauriConfig.version !== "../package.json") {
  failures.push("Tauri production config must derive its bundle version from package.json");
}
if (desktopSmokeBase !== resolve(tmpdir(), "verto-desktop-smoke")) {
  failures.push("fixture base is not the fixed OS temporary base");
}
if (
  !isAbsolute(desktopSmokeRoot) ||
  dirname(desktopSmokeRoot) !== desktopSmokeBase ||
  relative(desktopSmokeBase, desktopSmokeRoot) !== desktopSmokeRunId
) {
  failures.push("fixture root is not one validated run directory beneath the fixed base");
}
for (const [label, path] of Object.entries({
  vault: desktopSmokeVault,
  APPDATA: desktopSmokeRoamingData,
  LOCALAPPDATA: desktopSmokeLocalData,
  WEBVIEW2_USER_DATA_FOLDER: desktopSmokeWebViewData,
})) {
  if (!isAbsolute(path) || !isStrictChildPath(desktopSmokeRoot, path)) {
    failures.push(`${label} escapes the validated temporary fixture root`);
  }
}
const vaultFiles = {
  document: desktopSmokeDocument,
  "watcher source": desktopSmokeWatchedDocument,
  "watcher rename target": desktopSmokeRenamedDocument,
  "portable bookmarks": desktopSmokeBookmarks,
};
for (const [label, path] of Object.entries(vaultFiles)) {
  if (!isAbsolute(path) || !isStrictChildPath(desktopSmokeVault, path)) {
    failures.push(`${label} escapes the temporary smoke Vault`);
  }
}
if (new Set(Object.values(vaultFiles).map((path) => path.toLowerCase())).size !== 4) {
  failures.push("desktop smoke document paths must remain distinct");
}
if (
  dirname(desktopSmokeBookmarks) !== join(desktopSmokeVault, ".verto") ||
  basename(desktopSmokeBookmarks) !== "bookmarks.json"
) {
  failures.push("portable bookmark assertion does not target the Vault state file");
}
if (desktopSmokeEnvironment.APPDATA !== desktopSmokeRoamingData) {
  failures.push("WDIO does not pass the isolated APPDATA to the desktop process");
}
if (desktopSmokeEnvironment.LOCALAPPDATA !== desktopSmokeLocalData) {
  failures.push("WDIO does not pass the isolated LOCALAPPDATA to the desktop process");
}
if (desktopSmokeEnvironment.WEBVIEW2_USER_DATA_FOLDER !== desktopSmokeWebViewData) {
  failures.push("WDIO does not pass the isolated WebView2 profile to the desktop process");
}
for (const [name, base, path] of [
  ["native roaming profile", process.env.APPDATA, desktopSmokeNativeRoamingData],
  ["native local/WebView profile", process.env.LOCALAPPDATA, desktopSmokeNativeLocalData],
] as const) {
  if (
    !base ||
    !isAbsolute(base) ||
    dirname(path) !== resolve(base) ||
    basename(path) !== DESKTOP_SMOKE_APP_IDENTIFIER
  ) {
    failures.push(`${name} is not the exact smoke-only child of its Windows Known Folder`);
  }
}
for (const unsafeRunId of [
  "",
  ".",
  "..",
  "../escape",
  "..\\escape",
  "/absolute",
  "C:\\absolute",
  "\\\\server\\share",
  "contains.dot",
  "contains space",
  "a".repeat(65),
]) {
  expectRejectedRunId(unsafeRunId);
}
for (const safeRunId of ["local", "12345-2", "smoke_run"]) {
  try {
    validateDesktopSmokeRunId(safeRunId);
  } catch {
    failures.push(`safe run id was rejected: ${safeRunId}`);
  }
}
if (config.maxInstances !== 1) failures.push("desktop smoke must remain single-instance");
if (config.framework !== "mocha")
  failures.push("desktop smoke must use the configured Mocha runner");
if (config.hostname !== desktopSmokeDriverHost || config.port !== desktopSmokeDriverPort) {
  failures.push("WDIO does not target the external tauri-driver at config level");
}
const configuredCapabilities = Array.isArray(config.capabilities) ? config.capabilities : [];
const configuredCapability = configuredCapabilities[0] as
  | (WebdriverIO.Capabilities & {
      "tauri:options"?: {
        application?: unknown;
        webviewOptions?: { userDataFolder?: unknown };
      };
    })
  | undefined;
if (!configuredCapability || configuredCapabilities.length !== 1) {
  failures.push("desktop smoke must use exactly one Tauri capability");
} else {
  if ("browserName" in configuredCapability) {
    failures.push("Tauri capability must not contain a synthetic browserName");
  }
  if (configuredCapability["tauri:options"]?.application !== desktopAppBinary) {
    failures.push("Tauri capability does not target the guarded desktop binary");
  }
  if (
    configuredCapability["tauri:options"]?.webviewOptions?.userDataFolder !==
    desktopSmokeWebViewData
  ) {
    failures.push("Tauri capability does not give EdgeDriver the isolated WebView2 profile");
  }
}
const configuredService = config.services?.[0];
if (
  !Array.isArray(configuredService) ||
  configuredService[0] !== DesktopTauriDriverService ||
  config.services?.length !== 1
) {
  failures.push("WDIO does not use the repo-managed tauri-driver launcher");
} else {
  const options = configuredService[1] as Record<string, unknown>;
  if (
    options.host !== desktopSmokeDriverHost ||
    options.port !== desktopSmokeDriverPort ||
    options.nativePort !== desktopSmokeNativeDriverPort ||
    options.nativeDriverPath !== desktopSmokeEdgeDriver
  ) {
    failures.push("repo-managed tauri-driver launcher options do not match WDIO");
  }
}
if (desktopSmokeNativeDriverPort !== desktopSmokeDriverPort + 1) {
  failures.push("desktop smoke driver ports must remain one adjacent pair");
}
if (
  !isAbsolute(desktopSmokeEdgeDriver) ||
  dirname(desktopSmokeEdgeDriver) !== desktopSmokeEdgeDriverDirectory
) {
  failures.push("EdgeDriver path is not an absolute path in its managed cache directory");
}

if (failures.length > 0) {
  throw new Error(`Invalid desktop smoke configuration:\n- ${failures.join("\n- ")}`);
}

console.log(`Desktop smoke configuration is valid.\nBinary: ${desktopAppBinary}`);
