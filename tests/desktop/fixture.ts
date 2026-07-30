import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const DESKTOP_SMOKE_DIRECTORY = "verto-desktop-smoke";
const ROOT_MARKER_FILE = ".verto-desktop-smoke-root";
const MAX_RUN_ID_LENGTH = 64;
const RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
export const DESKTOP_SMOKE_ISOLATED_IDENTIFIER = "com.tsaiggo.verto.smoke";
export const DESKTOP_SMOKE_PRODUCTION_IDENTIFIER = "com.tsaiggo.verto";

function selectDesktopSmokeIdentifier(): string {
  const requested =
    process.env.VERTO_DESKTOP_SMOKE_APP_IDENTIFIER ?? DESKTOP_SMOKE_ISOLATED_IDENTIFIER;
  if (requested === DESKTOP_SMOKE_ISOLATED_IDENTIFIER) return requested;
  if (
    requested === DESKTOP_SMOKE_PRODUCTION_IDENTIFIER &&
    process.env.VERTO_DESKTOP_SMOKE_ALLOW_PRODUCTION_PROFILE === "1" &&
    process.env.GITHUB_ACTIONS === "true" &&
    process.env.CI === "true"
  ) {
    return requested;
  }
  throw new Error(
    "The production Verto profile is allowed only on an explicitly opted-in GitHub Actions runner."
  );
}

export const DESKTOP_SMOKE_APP_IDENTIFIER = selectDesktopSmokeIdentifier();
export const desktopSmokeUsesProductionProfile =
  DESKTOP_SMOKE_APP_IDENTIFIER === DESKTOP_SMOKE_PRODUCTION_IDENTIFIER;

export function validateDesktopSmokeRunId(value: string): string {
  if (
    value.length === 0 ||
    value.length > MAX_RUN_ID_LENGTH ||
    isAbsolute(value) ||
    value === "." ||
    value === ".." ||
    value.includes("/") ||
    value.includes("\\") ||
    !RUN_ID_PATTERN.test(value)
  ) {
    throw new Error(
      "VERTO_DESKTOP_SMOKE_RUN_ID must be 1-64 ASCII letters, digits, underscores, or hyphens."
    );
  }
  return value;
}

export function isStrictChildPath(base: string, candidate: string): boolean {
  const child = relative(resolve(base), resolve(candidate));
  return child !== "" && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

export const desktopSmokeRunId = validateDesktopSmokeRunId(
  process.env.VERTO_DESKTOP_SMOKE_RUN_ID ?? process.env.GITHUB_RUN_ID ?? "local"
);
export const desktopSmokeBase = resolve(tmpdir(), DESKTOP_SMOKE_DIRECTORY);
export const desktopSmokeRoot = resolve(desktopSmokeBase, desktopSmokeRunId);
export const desktopSmokeVault = join(desktopSmokeRoot, "vault");
export const desktopSmokeRoamingData = join(desktopSmokeRoot, "roaming");
export const desktopSmokeLocalData = join(desktopSmokeRoot, "local");
export const desktopSmokeWebViewData = join(desktopSmokeRoot, "webview2");
export const desktopSmokeDocument = join(desktopSmokeVault, "desktop-smoke-note.md");
export const desktopSmokeWatchedDocument = join(desktopSmokeVault, "watcher-created-note.md");
export const desktopSmokeRenamedDocument = join(desktopSmokeVault, "watcher-renamed-note.md");
export const desktopSmokeBookmarks = join(desktopSmokeVault, ".verto", "bookmarks.json");
export const desktopSmokeNativeRoamingData = join(
  requiredKnownFolder("APPDATA"),
  DESKTOP_SMOKE_APP_IDENTIFIER
);
export const desktopSmokeNativeLocalData = join(
  requiredKnownFolder("LOCALAPPDATA"),
  DESKTOP_SMOKE_APP_IDENTIFIER
);

export const DESKTOP_SMOKE_TITLE = "Desktop Smoke Note";
export const DESKTOP_SMOKE_INITIAL_MARKER = "Release binary opened this Markdown vault.";
export const DESKTOP_SMOKE_SAVED_MARKER = "Release binary saved this production edit.";
export const DESKTOP_SMOKE_LOCAL_DRAFT_MARKER =
  "Release binary kept this unsaved local conflict draft.";
export const DESKTOP_SMOKE_EXTERNAL_MARKER =
  "An external writer changed this Markdown file after it was opened.";
export const DESKTOP_SMOKE_WATCH_TITLE = "Watcher Created Note";

const AUTHORIZED_LIBRARY_FILE = "authorized-libraries-v1.json";
const ROOT_MARKER_CONTENT = `verto-desktop-smoke:${desktopSmokeRunId}\n`;
const NATIVE_MARKER_CONTENT = `verto-desktop-smoke-native:${DESKTOP_SMOKE_APP_IDENTIFIER}:${desktopSmokeRunId}\n`;
const ownedNativeDataDirectories = new Set<string>();

function requiredKnownFolder(name: "APPDATA" | "LOCALAPPDATA"): string {
  const value = process.env[name];
  if (process.platform !== "win32" || !value || !isAbsolute(value)) {
    throw new Error(`${name} must name an absolute Windows Known Folder for desktop smoke.`);
  }
  return resolve(value);
}

function verifiedDesktopSmokeRoot(): string {
  const root = resolve(desktopSmokeRoot);
  if (
    dirname(root) !== desktopSmokeBase ||
    !isStrictChildPath(desktopSmokeBase, root) ||
    relative(desktopSmokeBase, root) !== desktopSmokeRunId
  ) {
    throw new Error("Refusing to use a desktop smoke root outside the fixed temporary base.");
  }
  return root;
}

async function removeVerifiedDesktopSmokeRoot(): Promise<void> {
  const root = verifiedDesktopSmokeRoot();
  let rootStats;
  try {
    rootStats = await lstat(root);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }

  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new Error("Refusing to remove a desktop smoke root that is not a real directory.");
  }

  let marker: string;
  try {
    marker = await readFile(join(root, ROOT_MARKER_FILE), "utf8");
  } catch (error) {
    throw new Error("Refusing to remove an unmarked desktop smoke directory.", {
      cause: error,
    });
  }
  if (marker !== ROOT_MARKER_CONTENT) {
    throw new Error("Refusing to remove a desktop smoke directory with an invalid marker.");
  }

  await rm(root, { force: true, recursive: true });
}

function verifiedNativeDataDirectory(candidate: string): string {
  const directory = resolve(candidate);
  const expectedBase =
    candidate === desktopSmokeNativeRoamingData
      ? requiredKnownFolder("APPDATA")
      : candidate === desktopSmokeNativeLocalData
        ? requiredKnownFolder("LOCALAPPDATA")
        : null;
  if (
    !expectedBase ||
    dirname(directory) !== expectedBase ||
    basename(directory) !== DESKTOP_SMOKE_APP_IDENTIFIER ||
    !isStrictChildPath(expectedBase, directory)
  ) {
    throw new Error("Refusing to use a native data directory outside the smoke-only identifier.");
  }
  return directory;
}

async function assertNativeDataDirectoriesDoNotExist(): Promise<void> {
  for (const candidate of [desktopSmokeNativeRoamingData, desktopSmokeNativeLocalData]) {
    const directory = verifiedNativeDataDirectory(candidate);
    try {
      await lstat(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    throw new Error(
      `Refusing to start because the smoke-only native profile already exists: ${directory}`
    );
  }
}

async function createNativeDataDirectory(candidate: string): Promise<void> {
  const directory = verifiedNativeDataDirectory(candidate);
  await mkdir(directory);
  await writeFile(join(directory, ROOT_MARKER_FILE), NATIVE_MARKER_CONTENT, {
    encoding: "utf8",
    flag: "wx",
  });
  ownedNativeDataDirectories.add(directory);
}

async function removeOwnedNativeDataDirectories(): Promise<void> {
  const failures: unknown[] = [];
  for (const candidate of [desktopSmokeNativeLocalData, desktopSmokeNativeRoamingData]) {
    const directory = verifiedNativeDataDirectory(candidate);
    if (!ownedNativeDataDirectories.has(directory)) continue;

    try {
      const rootStats = await lstat(directory);
      if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
        throw new Error("The owned native smoke profile is no longer a real directory.");
      }
      const marker = await readFile(join(directory, ROOT_MARKER_FILE), "utf8");
      if (marker !== NATIVE_MARKER_CONTENT) {
        throw new Error("The owned native smoke profile marker changed; refusing cleanup.");
      }
      await rm(directory, { force: true, recursive: true });
      ownedNativeDataDirectories.delete(directory);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, "Could not safely remove the owned native smoke profile.");
  }
}

function windowsCanonicalPath(path: string): string {
  const absolute = resolve(path);
  if (absolute.startsWith("\\\\")) {
    return `\\\\?\\UNC\\${absolute.slice(2)}`;
  }
  return `\\\\?\\${absolute}`;
}

export async function prepareDesktopSmokeFixture(): Promise<void> {
  if (process.platform !== "win32") {
    throw new Error("The Verto desktop smoke fixture is currently Windows-only.");
  }

  await assertNativeDataDirectoriesDoNotExist();
  try {
    await removeVerifiedDesktopSmokeRoot();
    await mkdir(desktopSmokeBase, { recursive: true });
    await mkdir(verifiedDesktopSmokeRoot());
    await writeFile(join(desktopSmokeRoot, ROOT_MARKER_FILE), ROOT_MARKER_CONTENT, {
      encoding: "utf8",
      flag: "wx",
    });
    await Promise.all([
      mkdir(desktopSmokeVault, { recursive: true }),
      mkdir(desktopSmokeRoamingData, { recursive: true }),
      mkdir(desktopSmokeLocalData, { recursive: true }),
      mkdir(desktopSmokeWebViewData, { recursive: true }),
    ]);
    await createNativeDataDirectory(desktopSmokeNativeRoamingData);
    await createNativeDataDirectory(desktopSmokeNativeLocalData);

    const source = [
      "---",
      `title: ${DESKTOP_SMOKE_TITLE}`,
      "tags:",
      "  - desktop-smoke",
      "---",
      "",
      "# Production desktop vault",
      "",
      DESKTOP_SMOKE_INITIAL_MARKER,
      "",
    ].join("\n");
    await writeFile(desktopSmokeDocument, source, "utf8");

    const canonicalVault = windowsCanonicalPath(desktopSmokeVault);
    await writeFile(
      join(desktopSmokeNativeRoamingData, AUTHORIZED_LIBRARY_FILE),
      `${JSON.stringify(
        {
          version: 1,
          active: canonicalVault,
          recent: [canonicalVault],
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  } catch (error) {
    const cleanupFailures: unknown[] = [];
    try {
      await removeOwnedNativeDataDirectories();
    } catch (cleanupError) {
      cleanupFailures.push(cleanupError);
    }
    try {
      await removeVerifiedDesktopSmokeRoot();
    } catch (cleanupError) {
      cleanupFailures.push(cleanupError);
    }
    if (cleanupFailures.length > 0) {
      throw new AggregateError(
        [error, ...cleanupFailures],
        "Desktop smoke fixture setup failed and cleanup was incomplete."
      );
    }
    throw error;
  }
}

export async function cleanupDesktopSmokeFixture(): Promise<void> {
  const failures: unknown[] = [];
  try {
    await removeOwnedNativeDataDirectories();
  } catch (error) {
    failures.push(error);
  }
  try {
    await removeVerifiedDesktopSmokeRoot();
  } catch (error) {
    failures.push(error);
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, "Desktop smoke fixture cleanup was incomplete.");
  }
}
