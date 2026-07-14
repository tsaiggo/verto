// Desktop backend for the StateStore abstraction.
//
// localStorage remains the synchronous cache used by React snapshots. Each
// name is also restored from and mirrored to
// <activeFolder>/.verto/<name>.json, making the vault copy portable. A small
// per-name origin marker prevents the cache for one vault leaking into another
// while the asynchronous restore is in flight.

import { loadActiveLocalFolder, saveActiveLocalFolder } from "@/lib/local-folder";

import { createWebStore } from "./web";
import type { StateStore } from "./types";

export const STATE_STORE_ERROR_EVENT = "verto:state-store-error";

export interface StateStoreErrorDetail {
  operation: "hydrate" | "mirror" | "update";
  folder: string;
  name: string;
  message: string;
}

const STORE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;
const KNOWN_PORTABLE_STATE_NAMES = [
  "agent-threads",
  "annotations",
  "bookmarks",
  "collections",
  "reading-state",
  "summaries",
] as const;

interface StateFileSystem {
  read(folder: string, name: string): Promise<string | null>;
  write(folder: string, name: string, json: string): Promise<void>;
}
type LoadFileSystem = () => Promise<StateFileSystem>;

// Mirrors are created by whichever mounted consumer first asks for the active
// store, but library switching happens in the integration UI. Track pending
// work at module scope so that UI can establish a durable hand-off boundary
// before the native shell changes its active authorized root.
const pendingMirrorsByFolder = new Map<string, Set<Promise<boolean>>>();
const pendingHydrationsByFolder = new Map<string, Set<Promise<void>>>();
const failedMirrorsByFolder = new Map<string, Set<string>>();
const frozenFolders = new Set<string>();
export interface NativeLocalFolderStatus {
  folder: string | null;
  available: boolean;
}

let nativeReconciliation: Promise<NativeLocalFolderStatus> | null = null;
let recoverySequence = 0;

function trackHydration(folder: string, pending: Promise<void>): void {
  const pendingForFolder = pendingHydrationsByFolder.get(folder) ?? new Set<Promise<void>>();
  pendingForFolder.add(pending);
  pendingHydrationsByFolder.set(folder, pendingForFolder);
  const remove = () => {
    pendingForFolder.delete(pending);
    if (pendingForFolder.size === 0) pendingHydrationsByFolder.delete(folder);
  };
  void pending.then(remove, remove);
}

async function flushHydrations(folder: string): Promise<void> {
  while (true) {
    const pending = [...(pendingHydrationsByFolder.get(folder) ?? [])];
    if (pending.length === 0) return;
    const results = await Promise.allSettled(pending);
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    if (failed) throw failed.reason;
  }
}

function trackMirror(folder: string, name: string, pending: Promise<boolean>): void {
  const pendingForFolder = pendingMirrorsByFolder.get(folder) ?? new Set<Promise<boolean>>();
  pendingForFolder.add(pending);
  pendingMirrorsByFolder.set(folder, pendingForFolder);

  void pending.then((succeeded) => {
    const failedForFolder = failedMirrorsByFolder.get(folder) ?? new Set<string>();
    if (succeeded) failedForFolder.delete(name);
    else failedForFolder.add(name);
    if (failedForFolder.size === 0) failedMirrorsByFolder.delete(folder);
    else failedMirrorsByFolder.set(folder, failedForFolder);

    pendingForFolder.delete(pending);
    if (pendingForFolder.size === 0) pendingMirrorsByFolder.delete(folder);
  });
}

/**
 * Wait until every portable state write for `folder` is durable.
 *
 * The loop also catches writes queued while an earlier batch is being
 * flushed. A failed mirror blocks library switching instead of silently
 * abandoning the latest state in the global localStorage cache.
 */
export async function flushLocalFolderState(
  folder: string | null = loadActiveLocalFolder()
): Promise<void> {
  if (folder === null) return;

  while (true) {
    const pending = [...(pendingMirrorsByFolder.get(folder) ?? [])];
    if (pending.length === 0) break;
    await Promise.all(pending);
  }

  const failed = [...(failedMirrorsByFolder.get(folder) ?? [])];
  if (failed.length > 0) {
    throw new Error(
      `Could not finish saving ${failed.length === 1 ? `\"${failed[0]}\"` : `${failed.length} state files`} to the current library.`
    );
  }
}

/** Freeze new writes, then drain every mirror already queued for this root. */
export async function beginLocalFolderSwitch(
  folder: string | null = loadActiveLocalFolder()
): Promise<string | null> {
  if (folder === null) return null;
  frozenFolders.add(folder);
  try {
    await flushHydrations(folder);
    await flushLocalFolderState(folder);
    await recoverUnmirroredCaches(folder);
    return folder;
  } catch (error) {
    frozenFolders.delete(folder);
    throw error;
  }
}

/** Re-open the old root when native activation of the replacement failed. */
export function cancelLocalFolderSwitch(folder: string | null): void {
  if (folder !== null) frozenFolders.delete(folder);
}

/** Allow writes to the newly active root after local and native state agree. */
export function completeLocalFolderSwitch(folder: string): void {
  frozenFolders.delete(folder);
}

function stateDir(folder: string): string {
  return `${folder}/.verto`;
}

function originKey(name: string): string {
  return `verto:state-store-origin:${name}`;
}

function cachedValueKey(name: string): string {
  return `verto:${name}`;
}

function legacyDirtyKey(name: string): string {
  return `verto:state-store-dirty:${name}`;
}

const RECOVERY_PREFIX = "verto:state-store-recovery:";

function recoveryKey(folder: string, name: string): string {
  return `${RECOVERY_PREFIX}${encodeURIComponent(folder)}:${name}`;
}

const DIRTY_INDEX_KEY = "verto:state-store-dirty-index";

interface LegacyDirtyMarker {
  folder: string;
  revision: number;
}

interface RecoveryEntry {
  folder: string;
  name: string;
  json: string;
  token: string;
}

interface DirtyIndexEntry {
  folder: string;
  names: string[];
}

function readDirtyIndex(): DirtyIndexEntry[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(DIRTY_INDEX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): DirtyIndexEntry[] => {
      if (
        typeof entry !== "object" ||
        entry === null ||
        !("folder" in entry) ||
        !("names" in entry) ||
        typeof entry.folder !== "string" ||
        !Array.isArray(entry.names)
      ) {
        return [];
      }
      const names = (entry.names as unknown[]).filter(
        (name: unknown): name is string => typeof name === "string" && STORE_NAME_PATTERN.test(name)
      );
      return names.length > 0 ? [{ folder: entry.folder, names: [...new Set(names)] }] : [];
    });
  } catch {
    return [];
  }
}

function writeDirtyIndex(entries: DirtyIndexEntry[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    if (entries.length === 0) window.localStorage.removeItem(DIRTY_INDEX_KEY);
    else window.localStorage.setItem(DIRTY_INDEX_KEY, JSON.stringify(entries));
  } catch {
    // The per-name marker remains the primary recovery signal for mounted
    // stores; the index exists to recover names before their UI mounts.
  }
}

function addToDirtyIndex(folder: string, name: string): void {
  const entries = readDirtyIndex();
  const entry = entries.find((candidate) => candidate.folder === folder);
  if (entry) {
    if (!entry.names.includes(name)) entry.names.push(name);
  } else {
    entries.push({ folder, names: [name] });
  }
  writeDirtyIndex(entries);
}

function removeFromDirtyIndex(folder: string, name: string): void {
  const entries = readDirtyIndex()
    .map((entry) =>
      entry.folder === folder
        ? { ...entry, names: entry.names.filter((candidate) => candidate !== name) }
        : entry
    )
    .filter((entry) => entry.names.length > 0);
  writeDirtyIndex(entries);
}

function readOrigin(name: string): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    return window.localStorage.getItem(originKey(name));
  } catch {
    return null;
  }
}

function writeOrigin(name: string, folder: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(originKey(name), folder);
  } catch {
    // The web store owns reporting localStorage failures. An origin marker is
    // only an isolation hint and must never make state unavailable.
  }
}

function readCachedJson(name: string): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    return window.localStorage.getItem(cachedValueKey(name));
  } catch {
    return null;
  }
}

function readLegacyDirty(name: string): LegacyDirtyMarker | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(legacyDirtyKey(name));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("folder" in parsed) ||
      !("revision" in parsed) ||
      typeof parsed.folder !== "string" ||
      typeof parsed.revision !== "number" ||
      !Number.isSafeInteger(parsed.revision)
    ) {
      return null;
    }
    return { folder: parsed.folder, revision: parsed.revision };
  } catch {
    return null;
  }
}

function nextRecoveryToken(): string {
  recoverySequence += 1;
  return `${Date.now().toString(36)}-${recoverySequence.toString(36)}`;
}

function parseRecoveryEntry(raw: string | null): RecoveryEntry | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== "object" ||
      value === null ||
      !("folder" in value) ||
      !("name" in value) ||
      !("json" in value) ||
      !("token" in value) ||
      typeof value.folder !== "string" ||
      typeof value.name !== "string" ||
      !STORE_NAME_PATTERN.test(value.name) ||
      typeof value.json !== "string" ||
      typeof value.token !== "string"
    ) {
      return null;
    }
    return {
      folder: value.folder,
      name: value.name,
      json: value.json,
      token: value.token,
    };
  } catch {
    return null;
  }
}

function writeRecovery(folder: string, name: string, json: string): RecoveryEntry | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  const entry: RecoveryEntry = { folder, name, json, token: nextRecoveryToken() };
  try {
    window.localStorage.setItem(recoveryKey(folder, name), JSON.stringify(entry));
    addToDirtyIndex(folder, name);
    return entry;
  } catch {
    return null;
  }
}

function readRecovery(folder: string, name: string): RecoveryEntry | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  const current = parseRecoveryEntry(window.localStorage.getItem(recoveryKey(folder, name)));
  if (current?.folder === folder && current.name === name) return current;

  // Migrate the pre-journal marker while its exact cache payload is still
  // attributable to this folder. The old marker alone is never used after a
  // different vault has taken ownership of the global cache.
  const legacy = readLegacyDirty(name);
  const cachedJson = readCachedJson(name);
  if (legacy?.folder !== folder || readOrigin(name) !== folder || cachedJson === null) return null;
  const migrated = writeRecovery(folder, name, cachedJson);
  if (migrated) {
    try {
      window.localStorage.removeItem(legacyDirtyKey(name));
    } catch {
      // The exact journal is already durable; leaving the legacy pointer is safe.
    }
  }
  return migrated;
}

function clearRecovery(entry: RecoveryEntry): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const current = parseRecoveryEntry(
      window.localStorage.getItem(recoveryKey(entry.folder, entry.name))
    );
    if (current?.token !== entry.token) return;
    window.localStorage.removeItem(recoveryKey(entry.folder, entry.name));
    removeFromDirtyIndex(entry.folder, entry.name);
  } catch {
    // A stale journal is safe: recovery will mirror the exact payload again.
  }
}

function indexedRecoveryNames(folder: string): string[] {
  const names = new Set(
    readDirtyIndex()
      .filter((entry) => entry.folder === folder)
      .flatMap((entry) => entry.names)
  );
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key?.startsWith(RECOVERY_PREFIX)) {
          const entry = parseRecoveryEntry(window.localStorage.getItem(key));
          if (entry?.folder === folder) names.add(entry.name);
          continue;
        }
        const prefix = "verto:state-store-dirty:";
        if (key?.startsWith(prefix)) {
          const name = key.slice(prefix.length);
          if (readLegacyDirty(name)?.folder === folder) names.add(name);
        }
      }
    } catch {
      // The persisted index above remains available when key enumeration is
      // restricted by the embedding browser.
    }
  }
  return [...names].filter((name) => STORE_NAME_PATTERN.test(name));
}

function requireRecovery(folder: string, name: string, json: string): RecoveryEntry {
  const recovery = writeRecovery(folder, name, json);
  if (recovery) return recovery;
  throw new Error(`Could not preserve pending \"${name}\" state for recovery.`);
}

function moveFolderIdentity(from: string, to: string): void {
  if (from === to) return;
  const names = new Set<string>([...KNOWN_PORTABLE_STATE_NAMES, ...indexedRecoveryNames(from)]);
  for (const name of names) {
    const recovery = readRecovery(from, name);
    if (recovery) {
      const moved = requireRecovery(to, name, recovery.json);
      clearRecovery(recovery);
      // Keep the newly written token live. `clearRecovery` above only targets
      // the old folder key, including when both payloads happen to match.
      void moved;
    }
    if (readOrigin(name) === from) writeOrigin(name, to);
  }
}

/**
 * Attribute browser-era caches before replacing a stale renderer root with
 * the native registry's active root. This preserves upgrade data without ever
 * seeding it into a different library.
 */
function claimUnownedCaches(folder: string): void {
  const names = new Set<string>([...KNOWN_PORTABLE_STATE_NAMES, ...indexedRecoveryNames(folder)]);
  for (const name of names) {
    // Reading first upgrades an old `{folder, revision}` marker while its
    // cache payload is still attributable to this folder.
    if (readRecovery(folder, name)) continue;
    const cachedJson = readCachedJson(name);
    if (readOrigin(name) !== null || cachedJson === null) continue;
    try {
      JSON.parse(cachedJson);
    } catch (error) {
      reportError("hydrate", folder, name, error);
      throw error;
    }
    requireRecovery(folder, name, cachedJson);
    writeOrigin(name, folder);
  }
}

/**
 * Reconcile renderer state with the native authorization registry.
 *
 * The native registry is authoritative after a desktop restart. A stale JS
 * root can otherwise make every vault read fail before the user has a chance
 * to reconnect. Concurrent hydrations share one IPC query.
 */
export function reconcileNativeLocalFolder(): Promise<NativeLocalFolderStatus> {
  if (nativeReconciliation) return nativeReconciliation;

  nativeReconciliation = (async () => {
    const { getActiveLocalLibrary } = await import("@/lib/tauri");
    const rendererFolder = loadActiveLocalFolder();
    const native = await getActiveLocalLibrary(rendererFolder);
    if (rendererFolder !== native.folder) {
      if (rendererFolder !== null) {
        if (native.folder !== null && native.rendererMatchesActive) {
          moveFolderIdentity(rendererFolder, native.folder);
          claimUnownedCaches(native.folder);
        } else {
          claimUnownedCaches(rendererFolder);
        }
      }
      if (!saveActiveLocalFolder(native.folder ?? "")) {
        throw new Error("Could not reconcile the active library in renderer storage.");
      }
    }
    return { folder: native.folder, available: native.available };
  })();

  void nativeReconciliation.then(
    () => {
      nativeReconciliation = null;
    },
    () => {
      nativeReconciliation = null;
    }
  );
  return nativeReconciliation;
}

async function recoverUnmirroredCaches(folder: string): Promise<void> {
  const names = new Set<string>([...KNOWN_PORTABLE_STATE_NAMES, ...indexedRecoveryNames(folder)]);
  const fileSystem = await loadFileSystem();
  const loadFs: LoadFileSystem = () => Promise.resolve(fileSystem);

  for (const name of names) {
    const recovery = readRecovery(folder, name);
    if (recovery) {
      let value: unknown;
      try {
        value = JSON.parse(recovery.json);
      } catch (error) {
        reportError("hydrate", folder, name, error);
        throw error;
      }
      if (!(await mirrorToDisk(folder, name, recovery.json, loadFs))) {
        throw new Error(`Could not recover \"${name}\" before changing libraries.`);
      }
      if (loadActiveLocalFolder() === folder) {
        writeOrigin(name, folder);
        createWebStore().write(name, value);
      }
      clearRecovery(recovery);
      continue;
    }

    const cachedJson = readCachedJson(name);
    const origin = readOrigin(name);

    if (cachedJson === null || (origin !== null && origin !== folder)) continue;
    const raw = await fileSystem.read(folder, name);
    if (raw !== null) {
      // A portable file always wins over an unowned browser-era cache. Claim
      // it for the current root so a later vault cannot seed that stale cache.
      if (origin === null) {
        const value: unknown = JSON.parse(raw);
        writeOrigin(name, folder);
        createWebStore().write(name, value);
      }
      continue;
    }

    try {
      JSON.parse(cachedJson);
    } catch (error) {
      reportError("hydrate", folder, name, error);
      throw error;
    }
    const seeded = requireRecovery(folder, name, cachedJson);
    if (!(await mirrorToDisk(folder, name, cachedJson, loadFs))) {
      throw new Error(`Could not recover \"${name}\" before changing libraries.`);
    }
    if (origin === null) writeOrigin(name, folder);
    clearRecovery(seeded);
  }
}

/** Whether abandoning this root could strand an acknowledged portable write. */
export function hasPendingLocalFolderRecovery(folder: string): boolean {
  if ((pendingMirrorsByFolder.get(folder)?.size ?? 0) > 0) return true;
  if ((pendingHydrationsByFolder.get(folder)?.size ?? 0) > 0) return true;
  if ((failedMirrorsByFolder.get(folder)?.size ?? 0) > 0) return true;
  return indexedRecoveryNames(folder).some(
    (name) => readRecovery(folder, name) !== null || readLegacyDirty(name)?.folder === folder
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function reportError(
  operation: StateStoreErrorDetail["operation"],
  folder: string,
  name: string,
  error: unknown
): void {
  const detail: StateStoreErrorDetail = {
    operation,
    folder,
    name,
    message: errorMessage(error),
  };

  // A failed portable write must be observable even before a dedicated UI is
  // listening for the event. Do not include the JSON payload in either path.
  console.error(
    `[StateStore] Could not ${operation} "${name}" ${operation === "mirror" ? "to" : operation === "hydrate" ? "from" : "in"} ${stateDir(folder)}.`,
    error
  );

  if (
    typeof window !== "undefined" &&
    typeof window.dispatchEvent === "function" &&
    typeof CustomEvent === "function"
  ) {
    window.dispatchEvent(
      new CustomEvent<StateStoreErrorDetail>(STATE_STORE_ERROR_EVENT, { detail })
    );
  }
}

async function loadFileSystem(): Promise<StateFileSystem> {
  const { readVaultState, writeVaultState } = await import("@/lib/tauri");
  return {
    read: readVaultState,
    write: writeVaultState,
  };
}

async function mirrorToDisk(
  folder: string,
  name: string,
  json: string,
  loadFs: LoadFileSystem
): Promise<boolean> {
  try {
    const { write } = await loadFs();
    await write(folder, name, json);
    return true;
  } catch (error) {
    reportError("mirror", folder, name, error);
    return false;
  }
}

/**
 * Create the store for one vault. `folder` is captured so a pending hydrate
 * cannot accidentally apply to a different folder selected moments later.
 */
export function createLocalFolderStore(
  folder: string | null = loadActiveLocalFolder(),
  fileSystem?: StateFileSystem
): StateStore {
  const web = createWebStore();
  const hydration = new Map<string, Promise<void>>();
  const hydrated = new Set<string>();
  interface MirrorBatch {
    json: string;
    resolve: Array<(succeeded: boolean) => void>;
  }
  interface MirrorQueue {
    latest: MirrorBatch | null;
  }
  const mirrorQueues = new Map<string, MirrorQueue>();
  const revisions = new Map<string, number>();
  const loadFs: LoadFileSystem = fileSystem ? () => Promise.resolve(fileSystem) : loadFileSystem;

  function isValidName(name: string): boolean {
    return STORE_NAME_PATTERN.test(name);
  }

  function isCapturedFolderSelected(): boolean {
    return folder === null || loadActiveLocalFolder() === folder;
  }

  function isCapturedFolderWritable(): boolean {
    return isCapturedFolderSelected() && (folder === null || !frozenFolders.has(folder));
  }

  function queueMirror(name: string, json: string): Promise<boolean> {
    if (folder === null) return Promise.resolve(false);
    let resolve!: (succeeded: boolean) => void;
    const result = new Promise<boolean>((settle) => {
      resolve = settle;
    });
    const existing = mirrorQueues.get(name);
    if (existing) {
      // Keep one in-flight write and one latest payload. Every superseded
      // caller waits for that latest payload, so awaited mutations retain a
      // truthful durability signal without fsyncing every scroll frame.
      if (existing.latest) {
        existing.latest.json = json;
        existing.latest.resolve.push(resolve);
      } else {
        existing.latest = { json, resolve: [resolve] };
      }
      return result;
    }

    const queue: MirrorQueue = { latest: null };
    mirrorQueues.set(name, queue);

    const run = (batch: MirrorBatch) => {
      const pending = mirrorToDisk(folder, name, batch.json, loadFs);
      trackMirror(folder, name, pending);
      void pending.then((succeeded) => {
        batch.resolve.forEach((settle) => settle(succeeded));
        const next = queue.latest;
        queue.latest = null;
        if (next) run(next);
        else if (mirrorQueues.get(name) === queue) mirrorQueues.delete(name);
      });
    };

    run({ json, resolve: [resolve] });
    return result;
  }

  function ensureHydrated(name: string): Promise<void> {
    if (folder === null || !isValidName(name)) return Promise.resolve();

    const existing = hydration.get(name);
    if (existing) return existing;

    const startingRevision = revisions.get(name) ?? 0;
    const pending = (async () => {
      try {
        if (!fileSystem) {
          const active = await reconcileNativeLocalFolder();
          if (active.folder !== folder) {
            if (active.folder !== null && active.available) {
              await createLocalFolderStore(active.folder).hydrate?.(name);
            }
            hydrated.add(name);
            return;
          }
          if (!active.available) {
            hydrated.add(name);
            return;
          }
        }
        const { read } = await loadFs();
        const cachedJson = readCachedJson(name);

        if ((revisions.get(name) ?? 0) !== startingRevision) {
          hydrated.add(name);
          return;
        }

        // The recovery journal owns the exact acknowledged payload. It wins
        // even when an older portable file already exists and even after a
        // different library has replaced the global browser cache.
        const recovery = readRecovery(folder, name);
        if (recovery) {
          const value: unknown = JSON.parse(recovery.json);
          const mirrored = await queueMirror(name, recovery.json);
          if (!mirrored) {
            throw new Error(`Could not recover pending \"${name}\" state.`);
          }
          if (isCapturedFolderSelected()) {
            writeOrigin(name, folder);
            web.write(name, value);
          }
          clearRecovery(recovery);
          hydrated.add(name);
          return;
        }

        const raw = await read(folder, name);

        if (raw === null) {
          // First-run migration: when this cache predates origin markers, seed
          // the currently selected vault. A cache explicitly owned by another
          // vault is never copied across.
          if (
            (readOrigin(name) === null || readOrigin(name) === folder) &&
            cachedJson !== null &&
            (revisions.get(name) ?? 0) === startingRevision
          ) {
            // Validate before creating a portable file that future launches
            // would be unable to hydrate.
            JSON.parse(cachedJson);
            const seeded = requireRecovery(folder, name, cachedJson);
            const mirrored = await queueMirror(name, cachedJson);
            if (!mirrored) {
              throw new Error(`Could not recover pending \"${name}\" state.`);
            }
            if ((revisions.get(name) ?? 0) === startingRevision && isCapturedFolderSelected()) {
              writeOrigin(name, folder);
            }
            clearRecovery(seeded);
          }
          hydrated.add(name);
          return;
        }

        const value: unknown = JSON.parse(raw);

        // A synchronous user write that happened after hydration began wins.
        // Its own mirror is already queued, so applying stale disk data here
        // would roll the UI back and could overwrite the new value later.
        if ((revisions.get(name) ?? 0) !== startingRevision) {
          hydrated.add(name);
          return;
        }
        if (!isCapturedFolderSelected()) {
          return;
        }

        writeOrigin(name, folder);
        web.write(name, value);
        hydrated.add(name);
      } catch (error) {
        reportError("hydrate", folder, name, error);
        // Do not permanently cache a failed restore. A later read (or a reload
        // after the user fixes folder permissions / malformed JSON) can retry.
        hydration.delete(name);
        throw error;
      }
    })();

    hydration.set(name, pending);
    trackHydration(folder, pending);
    return pending;
  }

  function writeValue<T>(name: string, value: T): Promise<boolean> {
    const json = JSON.stringify(value);
    if (json === undefined) {
      throw new Error(`Could not serialize \"${name}\" state.`);
    }
    const recovery = folder === null ? null : requireRecovery(folder, name, json);
    const revision = (revisions.get(name) ?? 0) + 1;
    revisions.set(name, revision);

    if (folder !== null) {
      writeOrigin(name, folder);
    }
    web.write(name, value);

    if (folder === null) return Promise.resolve(true);
    const pending = queueMirror(name, json);
    void pending.then((succeeded) => {
      if (succeeded && recovery) clearRecovery(recovery);
    });
    return pending;
  }

  function readValue<T>(name: string, fallback: T): T {
    const origin = readOrigin(name);
    if (folder !== null && origin !== null && origin !== folder) return fallback;
    return web.read(name, fallback);
  }

  return {
    read<T>(name: string, fallback: T): T {
      if (!isValidName(name)) return fallback;
      if (folder === null || !frozenFolders.has(folder)) {
        void ensureHydrated(name).catch(() => {});
      }

      // A global localStorage cache may still contain the last-opened vault's
      // value. Until this vault's disk copy arrives, do not expose that value.
      return readValue(name, fallback);
    },

    async hydrate(name: string): Promise<void> {
      await ensureHydrated(name);
    },

    update<T>(name: string, fallback: T, updater: (current: T) => T): Promise<T> {
      if (!isValidName(name)) return Promise.resolve(updater(fallback));

      if (!isCapturedFolderWritable()) {
        const error = new Error("The active local library changed before state could be saved.");
        reportError("update", folder ?? "", name, error);
        return Promise.reject(error);
      }

      const apply = (): { next: T; persisted: Promise<boolean> } => {
        if (!isCapturedFolderWritable()) {
          const error = new Error("The active local library changed before state could be saved.");
          reportError("update", folder ?? "", name, error);
          throw error;
        }
        const next = updater(readValue(name, fallback));
        return { next, persisted: writeValue(name, next) };
      };

      const settle = async ({ next, persisted }: ReturnType<typeof apply>): Promise<T> => {
        if (!(await persisted)) {
          throw new Error(`Could not save \"${name}\" to the active local library.`);
        }
        return next;
      };

      // Once restored, keep browser writes synchronous (notably pagehide
      // reading progress) while retaining a Promise-based API for startup.
      if (hydrated.has(name)) {
        try {
          return settle(apply());
        } catch (error) {
          return Promise.reject(error);
        }
      }
      return ensureHydrated(name).then(apply).then(settle);
    },

    write<T>(name: string, value: T): void {
      if (!isValidName(name)) return;
      if (!isCapturedFolderWritable()) return;
      void ensureHydrated(name).catch(() => {});
      void writeValue(name, value);
    },

    subscribe(listener: () => void): () => void {
      return web.subscribe(listener);
    },
  };
}
