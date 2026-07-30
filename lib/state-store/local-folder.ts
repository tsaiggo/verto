// Desktop backend for the StateStore abstraction.
//
// localStorage remains the synchronous cache used by React snapshots. Each
// name is also restored from and mirrored to
// <activeFolder>/.verto/<name>.json, making the vault copy portable. A small
// per-name origin marker prevents the cache for one vault leaking into another
// while the asynchronous restore is in flight.

import {
  ACTIVE_LOCAL_FOLDER_KEY,
  LOCAL_FOLDER_CHANGED_EVENT,
  loadActiveLocalFolder,
  saveActiveLocalFolder,
} from "@/lib/local-folder";

import { createWebStore } from "./web";
import type { StateStore } from "./types";

export const STATE_STORE_ERROR_EVENT = "verto:state-store-error";

export interface StateStoreErrorDetail {
  operation: "hydrate" | "mirror" | "update";
  folder: string;
  name: string;
  message: string;
  code?: string;
  expectedRevision?: string | null;
  actualRevision?: string | null;
  conflictPath?: string;
  preservationError?: string;
}

const STORE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;
const WRITER_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
export const KNOWN_PORTABLE_STATE_NAMES = [
  "agent-threads",
  "annotations",
  "bookmarks",
  "collections",
  "reading-state",
  "summaries",
] as const;
const KNOWN_PORTABLE_STATE_NAME_SET = new Set<string>(KNOWN_PORTABLE_STATE_NAMES);

interface VersionedStateFile {
  json: string | null;
  revision: string | null;
}

interface StateWriteReceipt {
  revision: string;
}

interface StateWriteOptions {
  expectedRevision: string | null;
  writerId: string;
  recoveryToken: string;
}

interface StateFileSystem {
  read(folder: string, name: string): Promise<VersionedStateFile>;
  write(
    folder: string,
    name: string,
    json: string,
    options: StateWriteOptions
  ): Promise<StateWriteReceipt>;
}
type LoadFileSystem = () => Promise<StateFileSystem>;

interface MirrorSuccess {
  succeeded: true;
  revision: string;
}

interface MirrorFailure {
  succeeded: false;
  conflict: boolean;
  error: unknown;
}

type MirrorOutcome = MirrorSuccess | MirrorFailure;

// Mirrors are created by whichever mounted consumer first asks for the active
// store, but library switching happens in the integration UI. Track pending
// work at module scope so that UI can establish a durable hand-off boundary
// before the native shell changes its active authorized root.
const pendingMirrorsByFolder = new Map<string, Set<Promise<MirrorOutcome>>>();
const pendingHydrationsByFolder = new Map<string, Set<Promise<void>>>();
const pendingMirrorsByFolderAndName = new Map<string, Map<string, Set<Promise<MirrorOutcome>>>>();
const pendingHydrationsByFolderAndName = new Map<string, Map<string, Set<Promise<void>>>>();
const failedMirrorsByFolder = new Map<string, Set<string>>();
const frozenFolders = new Set<string>();
const confirmedDiskRevisionsByFolder = new Map<string, Map<string, string | null>>();
export interface NativeLocalFolderStatus {
  folder: string | null;
  available: boolean;
}

let nativeReconciliation: Promise<NativeLocalFolderStatus> | null = null;
let recoverySequence = 0;
let observedActivationWindow: Window | null = null;
let observedActiveFolder: string | null = null;
let localFolderActivationEpoch = 0;
const fallbackWriterId = `renderer-${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2)}`;

function observeLocalFolderActivation(): number {
  if (typeof window === "undefined") return localFolderActivationEpoch;

  if (observedActivationWindow !== window) {
    observedActivationWindow?.removeEventListener(
      LOCAL_FOLDER_CHANGED_EVENT,
      handleLocalFolderActivation
    );
    observedActivationWindow?.removeEventListener("storage", handleActiveFolderStorage);
    observedActivationWindow = window;
    observedActiveFolder = loadActiveLocalFolder();
    localFolderActivationEpoch += 1;
    window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, handleLocalFolderActivation);
    window.addEventListener("storage", handleActiveFolderStorage);
  }

  const active = loadActiveLocalFolder();
  if (active !== observedActiveFolder) {
    observedActiveFolder = active;
    localFolderActivationEpoch += 1;
  }
  return localFolderActivationEpoch;
}

function handleLocalFolderActivation(): void {
  observeLocalFolderActivation();
}

function handleActiveFolderStorage(event: Event): void {
  if ((event as { key?: string | null }).key === ACTIVE_LOCAL_FOLDER_KEY) {
    observeLocalFolderActivation();
  }
}

function writerId(): string {
  if (typeof window === "undefined" || !window.localStorage) return fallbackWriterId;
  try {
    const existing = window.localStorage.getItem("verto:state-store-writer-id");
    if (existing && WRITER_ID_PATTERN.test(existing)) return existing;
    const created =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? `renderer-${crypto.randomUUID()}`
        : fallbackWriterId;
    window.localStorage.setItem("verto:state-store-writer-id", created);
    return window.localStorage.getItem("verto:state-store-writer-id") ?? created;
  } catch {
    return fallbackWriterId;
  }
}

function trackHydration(folder: string, name: string, pending: Promise<void>): void {
  const pendingForFolder = pendingHydrationsByFolder.get(folder) ?? new Set<Promise<void>>();
  pendingForFolder.add(pending);
  pendingHydrationsByFolder.set(folder, pendingForFolder);
  const pendingByName =
    pendingHydrationsByFolderAndName.get(folder) ?? new Map<string, Set<Promise<void>>>();
  const pendingForName = pendingByName.get(name) ?? new Set<Promise<void>>();
  pendingForName.add(pending);
  pendingByName.set(name, pendingForName);
  pendingHydrationsByFolderAndName.set(folder, pendingByName);
  const remove = () => {
    pendingForFolder.delete(pending);
    if (pendingForFolder.size === 0) pendingHydrationsByFolder.delete(folder);
    pendingForName.delete(pending);
    if (pendingForName.size === 0) pendingByName.delete(name);
    if (pendingByName.size === 0) pendingHydrationsByFolderAndName.delete(folder);
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

function trackMirror(folder: string, name: string, pending: Promise<MirrorOutcome>): void {
  const pendingForFolder = pendingMirrorsByFolder.get(folder) ?? new Set<Promise<MirrorOutcome>>();
  pendingForFolder.add(pending);
  pendingMirrorsByFolder.set(folder, pendingForFolder);
  const pendingByName =
    pendingMirrorsByFolderAndName.get(folder) ?? new Map<string, Set<Promise<MirrorOutcome>>>();
  const pendingForName = pendingByName.get(name) ?? new Set<Promise<MirrorOutcome>>();
  pendingForName.add(pending);
  pendingByName.set(name, pendingForName);
  pendingMirrorsByFolderAndName.set(folder, pendingByName);

  const finalize = (outcome: MirrorOutcome) => {
    const failedForFolder = failedMirrorsByFolder.get(folder) ?? new Set<string>();
    if (outcome.succeeded) failedForFolder.delete(name);
    else failedForFolder.add(name);
    if (failedForFolder.size === 0) failedMirrorsByFolder.delete(folder);
    else failedMirrorsByFolder.set(folder, failedForFolder);

    pendingForFolder.delete(pending);
    if (pendingForFolder.size === 0) pendingMirrorsByFolder.delete(folder);
    pendingForName.delete(pending);
    if (pendingForName.size === 0) pendingByName.delete(name);
    if (pendingByName.size === 0) pendingMirrorsByFolderAndName.delete(folder);
  };
  void pending.then(finalize, (error: unknown) => {
    finalize({
      succeeded: false,
      conflict: isPortableStateConflict(error),
      error,
    });
  });
}

function hasUnsavedLocalFolderState(folder: string, name: string): boolean {
  return Boolean(failedMirrorsByFolder.get(folder)?.has(name) || readRecovery(folder, name));
}

async function flushLocalFolderStateName(folder: string, name: string): Promise<void> {
  let firstFailure: unknown;
  while (true) {
    const pending = [...(pendingHydrationsByFolderAndName.get(folder)?.get(name) ?? [])];
    if (pending.length === 0) break;
    const results = await Promise.allSettled(pending);
    firstFailure ??= results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    )?.reason;
  }

  while (true) {
    const pending = [...(pendingMirrorsByFolderAndName.get(folder)?.get(name) ?? [])];
    if (pending.length === 0) break;
    await Promise.all(pending);
  }

  if (firstFailure) throw firstFailure;
  if (hasUnsavedLocalFolderState(folder, name)) {
    throw new Error(`Could not safely refresh "${name}" while its local state is unsaved.`);
  }
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

  let hydrationFailure: unknown;
  try {
    await flushHydrations(folder);
  } catch (error) {
    hydrationFailure = error;
  }

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
  if (hydrationFailure) throw hydrationFailure;
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
  version: 2;
  folder: string;
  name: string;
  json: string;
  token: string;
  expectedRevision: string | null;
  expectedKnown: boolean;
  createdAt: number;
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

function requiredLocalStorage(): Storage {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    // Fall through to one fail-closed error shared by quota/privacy modes.
  }
  throw new Error("Browser storage is unavailable for the portable state cache.");
}

function restoreStorageValue(storage: Storage, key: string, value: string | null): void {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // Best-effort rollback only; the original cache commit error remains the
    // actionable failure and its disk baseline is invalidated by the caller.
  }
}

function dispatchCachedValueChange(key: string): void {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  const event =
    typeof StorageEvent === "function"
      ? new StorageEvent("storage", { key })
      : new Event("storage");
  window.dispatchEvent(event);
}

function commitCachedJson(name: string, folder: string, json: string | null): void {
  const storage = requiredLocalStorage();
  const cacheKey = cachedValueKey(name);
  const markerKey = originKey(name);
  const previousCache = storage.getItem(cacheKey);
  const previousOrigin = storage.getItem(markerKey);

  try {
    storage.setItem(markerKey, folder);
    if (storage.getItem(markerKey) !== folder) {
      throw new Error("portable state origin marker was not stored");
    }
    if (json === null) storage.removeItem(cacheKey);
    else storage.setItem(cacheKey, json);
    if (storage.getItem(cacheKey) !== json) {
      throw new Error("portable state cache was not stored");
    }
  } catch (error) {
    restoreStorageValue(storage, markerKey, previousOrigin);
    restoreStorageValue(storage, cacheKey, previousCache);
    throw new Error(`Could not update the local cache for "${name}".`, { cause: error });
  }

  dispatchCachedValueChange(cacheKey);
}

function claimCachedValue(name: string, folder: string): void {
  const storage = requiredLocalStorage();
  const key = originKey(name);
  const previous = storage.getItem(key);
  try {
    storage.setItem(key, folder);
    if (storage.getItem(key) !== folder) {
      throw new Error("portable state origin marker was not stored");
    }
  } catch (error) {
    restoreStorageValue(storage, key, previous);
    throw new Error(`Could not claim the local cache for "${name}".`, { cause: error });
  }
}

function clearCachedValue(name: string, folder: string): void {
  commitCachedJson(name, folder, null);
}

function forgetConfirmedDiskRevision(folder: string, name: string): void {
  const revisions = confirmedDiskRevisionsByFolder.get(folder);
  revisions?.delete(name);
  if (revisions?.size === 0) confirmedDiskRevisionsByFolder.delete(folder);
}

function commitHydratedJson(name: string, folder: string, json: string | null): void {
  try {
    commitCachedJson(name, folder, json);
  } catch (error) {
    forgetConfirmedDiskRevision(folder, name);
    throw error;
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

function getConfirmedDiskRevision(
  folder: string,
  name: string
): { known: boolean; revision: string | null } {
  const revisions = confirmedDiskRevisionsByFolder.get(folder);
  if (!revisions?.has(name)) return { known: false, revision: null };
  return { known: true, revision: revisions.get(name) ?? null };
}

function confirmDiskRevision(folder: string, name: string, revision: string | null): void {
  const revisions = confirmedDiskRevisionsByFolder.get(folder) ?? new Map<string, string | null>();
  revisions.set(name, revision);
  confirmedDiskRevisionsByFolder.set(folder, revisions);
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
      version: 2,
      folder: value.folder,
      name: value.name,
      json: value.json,
      token: value.token,
      expectedRevision:
        "expectedRevision" in value &&
        (typeof value.expectedRevision === "string" || value.expectedRevision === null)
          ? value.expectedRevision
          : null,
      expectedKnown: "expectedKnown" in value && value.expectedKnown === true,
      createdAt:
        "createdAt" in value &&
        typeof value.createdAt === "number" &&
        Number.isFinite(value.createdAt)
          ? value.createdAt
          : 0,
    };
  } catch {
    return null;
  }
}

function persistRecovery(entry: RecoveryEntry): RecoveryEntry | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    window.localStorage.setItem(recoveryKey(entry.folder, entry.name), JSON.stringify(entry));
    addToDirtyIndex(entry.folder, entry.name);
    return entry;
  } catch {
    return null;
  }
}

function writeRecovery(
  folder: string,
  name: string,
  json: string,
  expected = getConfirmedDiskRevision(folder, name),
  createdAt = Date.now()
): RecoveryEntry | null {
  return persistRecovery({
    version: 2,
    folder,
    name,
    json,
    token: nextRecoveryToken(),
    expectedRevision: expected.revision,
    expectedKnown: expected.known,
    createdAt,
  });
}

function readRecovery(folder: string, name: string): RecoveryEntry | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  const current = parseRecoveryEntry(window.localStorage.getItem(recoveryKey(folder, name)));
  if (current?.folder === folder && current.name === name) {
    if (current.createdAt === 0) {
      return (
        persistRecovery({
          ...current,
          createdAt: Date.now(),
        }) ?? current
      );
    }
    return current;
  }

  // Migrate the pre-journal marker while its exact cache payload is still
  // attributable to this folder. The old marker alone is never used after a
  // different vault has taken ownership of the global cache.
  const legacy = readLegacyDirty(name);
  const cachedJson = readCachedJson(name);
  if (legacy?.folder !== folder || readOrigin(name) !== folder || cachedJson === null) return null;
  const migrated = writeRecovery(
    folder,
    name,
    cachedJson,
    { known: false, revision: null },
    Date.now()
  );
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

function setRecoveryExpectation(
  entry: RecoveryEntry,
  revision: string | null
): RecoveryEntry | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  const current = parseRecoveryEntry(
    window.localStorage.getItem(recoveryKey(entry.folder, entry.name))
  );
  if (current?.token !== entry.token) return null;
  return persistRecovery({
    ...current,
    expectedRevision: revision,
    expectedKnown: true,
    createdAt: current.createdAt || Date.now(),
  });
}

function rebaseQueuedRecovery(entry: RecoveryEntry, revision: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const current = parseRecoveryEntry(
    window.localStorage.getItem(recoveryKey(entry.folder, entry.name))
  );
  if (!current || current.token === entry.token) return;
  if (
    current.expectedKnown !== entry.expectedKnown ||
    current.expectedRevision !== entry.expectedRevision
  ) {
    return;
  }
  persistRecovery({
    ...current,
    expectedRevision: revision,
    expectedKnown: true,
    createdAt: current.createdAt || Date.now(),
  });
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

function requireRecovery(
  folder: string,
  name: string,
  json: string,
  expected = getConfirmedDiskRevision(folder, name),
  createdAt = Date.now()
): RecoveryEntry {
  const recovery = writeRecovery(folder, name, json, expected, createdAt);
  if (recovery) return recovery;
  throw new Error(`Could not preserve pending \"${name}\" state for recovery.`);
}

function moveFolderIdentity(from: string, to: string): void {
  if (from === to) return;
  const names = new Set<string>([...KNOWN_PORTABLE_STATE_NAMES, ...indexedRecoveryNames(from)]);
  for (const name of names) {
    const recovery = readRecovery(from, name);
    if (recovery) {
      const moved = requireRecovery(
        to,
        name,
        recovery.json,
        {
          known: recovery.expectedKnown,
          revision: recovery.expectedRevision,
        },
        recovery.createdAt
      );
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
      try {
        JSON.parse(recovery.json);
      } catch (error) {
        reportError("hydrate", folder, name, error);
        throw error;
      }
      const pending = recoverEntry(folder, name, recovery, fileSystem, loadFs);
      trackMirror(folder, name, pending);
      const outcome = await pending;
      if (!outcome.succeeded) {
        throw new Error(`Could not recover \"${name}\" before changing libraries.`);
      }
      if (loadActiveLocalFolder() === folder) {
        commitHydratedJson(name, folder, recovery.json);
      }
      continue;
    }

    const cachedJson = readCachedJson(name);
    const origin = readOrigin(name);

    if (cachedJson === null || (origin !== null && origin !== folder)) continue;
    const disk = await fileSystem.read(folder, name);
    if (disk.json !== null) {
      // A portable file always wins over an unowned browser-era cache. Claim
      // it for the current root so a later vault cannot seed that stale cache.
      if (origin === null) {
        JSON.parse(disk.json);
        commitHydratedJson(name, folder, disk.json);
        confirmDiskRevision(folder, name, disk.revision);
      }
      continue;
    }

    // An owned cache without a recovery marker is only a read-through cache,
    // not evidence of an unsaved write. Recreating a state file from it would
    // undo a legitimate deletion performed by another synced device.
    const legacyDirty = readLegacyDirty(name);
    if (origin === folder && legacyDirty?.folder !== folder) continue;

    try {
      JSON.parse(cachedJson);
    } catch (error) {
      reportError("hydrate", folder, name, error);
      throw error;
    }
    confirmDiskRevision(folder, name, disk.revision);
    const seeded = requireRecovery(folder, name, cachedJson, {
      known: true,
      revision: disk.revision,
    });
    const pending = mirrorToDisk(folder, name, seeded, loadFs);
    trackMirror(folder, name, pending);
    if (!(await pending).succeeded) {
      throw new Error(`Could not recover \"${name}\" before changing libraries.`);
    }
    if (origin === null) {
      try {
        claimCachedValue(name, folder);
      } catch (error) {
        forgetConfirmedDiskRevision(folder, name);
        throw error;
      }
    }
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

interface PortableStateConflict {
  code: "PORTABLE_STATE_CONFLICT";
  expectedRevision: string | null;
  actualRevision: string | null;
  conflictPath?: string;
  preservationError?: string;
}

function isPortableStateConflict(error: unknown): error is PortableStateConflict {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "PORTABLE_STATE_CONFLICT"
  );
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
    ...(isPortableStateConflict(error)
      ? {
          code: error.code,
          expectedRevision: error.expectedRevision,
          actualRevision: error.actualRevision,
          ...(error.conflictPath ? { conflictPath: error.conflictPath } : {}),
          ...(error.preservationError ? { preservationError: error.preservationError } : {}),
        }
      : {}),
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
  const { readVaultStateVersioned, writeVaultStateIfRevision } = await import("@/lib/tauri");
  return {
    read: readVaultStateVersioned,
    write: writeVaultStateIfRevision,
  };
}

async function mirrorToDisk(
  folder: string,
  name: string,
  recovery: RecoveryEntry,
  loadFs: LoadFileSystem,
  canCommit: () => boolean = () => true
): Promise<MirrorOutcome> {
  try {
    const { write } = await loadFs();
    const receipt = await write(folder, name, recovery.json, {
      expectedRevision: recovery.expectedRevision,
      writerId: writerId(),
      recoveryToken: recovery.token,
    });
    if (canCommit()) {
      confirmDiskRevision(folder, name, receipt.revision);
      rebaseQueuedRecovery(recovery, receipt.revision);
      clearRecovery(recovery);
    }
    return { succeeded: true, revision: receipt.revision };
  } catch (error) {
    reportError("mirror", folder, name, error);
    return { succeeded: false, conflict: isPortableStateConflict(error), error };
  }
}

async function recoverEntry(
  folder: string,
  name: string,
  recovery: RecoveryEntry,
  fileSystem: StateFileSystem,
  loadFs: LoadFileSystem,
  disk?: VersionedStateFile,
  canCommit: () => boolean = () => true
): Promise<MirrorOutcome> {
  const currentDisk = disk ?? (await fileSystem.read(folder, name));

  // A crash can happen after the atomic replacement but before localStorage
  // clears the journal. Matching bytes prove the acknowledged value is
  // already durable without another write.
  if (currentDisk.json === recovery.json) {
    if (canCommit()) {
      confirmDiskRevision(folder, name, currentDisk.revision);
      clearRecovery(recovery);
    }
    return { succeeded: true, revision: currentDisk.revision ?? "" };
  }

  let writableRecovery = recovery;
  if (!recovery.expectedKnown) {
    // Old journals did not capture a baseline. Null is the only safe CAS
    // expectation: it seeds a still-missing file, while an existing file
    // conflicts natively and receives the shell's preservation sidecar.
    if (currentDisk.json === null) {
      writableRecovery = setRecoveryExpectation(recovery, null) ?? recovery;
    }
  }

  return mirrorToDisk(folder, name, writableRecovery, loadFs, canCommit);
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
  const hydrationEpochs = new Map<string, number>();
  const hydrated = new Map<string, number>();
  interface MirrorBatch {
    recovery: RecoveryEntry;
    resolve: Array<(outcome: MirrorOutcome) => void>;
    canCommit?: () => boolean;
  }
  interface MirrorQueue {
    latest: MirrorBatch | null;
  }
  const mirrorQueues = new Map<string, MirrorQueue>();
  const rendererGenerations = new Map<string, number>();
  const recoveryTokenAwaitingBaselineByName = new Map<string, string>();
  const loadFs: LoadFileSystem = fileSystem ? () => Promise.resolve(fileSystem) : loadFileSystem;

  function isValidName(name: string): boolean {
    return STORE_NAME_PATTERN.test(name);
  }

  function activationEpoch(): number {
    return observeLocalFolderActivation();
  }

  function isCapturedFolderSelected(expectedEpoch?: number): boolean {
    const currentEpoch = activationEpoch();
    return (
      folder === null ||
      (loadActiveLocalFolder() === folder &&
        (expectedEpoch === undefined || expectedEpoch === currentEpoch))
    );
  }

  function forgetHydration(name: string, expectedEpoch: number): void {
    if (hydrationEpochs.get(name) === expectedEpoch) {
      hydration.delete(name);
      hydrationEpochs.delete(name);
    }
    if (hydrated.get(name) === expectedEpoch) {
      hydrated.delete(name);
    }
  }

  function markHydrated(name: string, expectedEpoch: number): void {
    if (isCapturedFolderSelected(expectedEpoch)) {
      hydrated.set(name, expectedEpoch);
    }
  }

  function isCapturedFolderWritable(): boolean {
    return isCapturedFolderSelected() && (folder === null || !frozenFolders.has(folder));
  }

  function queueMirror(
    name: string,
    recovery: RecoveryEntry,
    canCommit?: () => boolean
  ): Promise<MirrorOutcome> {
    if (folder === null) {
      return Promise.resolve({
        succeeded: false,
        conflict: false,
        error: new Error("A local folder is required for portable state."),
      });
    }
    let resolve!: (outcome: MirrorOutcome) => void;
    const result = new Promise<MirrorOutcome>((settle) => {
      resolve = settle;
    });
    const existing = mirrorQueues.get(name);
    if (existing) {
      // Keep one in-flight write and one latest payload. Every superseded
      // caller waits for that latest payload, so awaited mutations retain a
      // truthful durability signal without fsyncing every scroll frame.
      if (existing.latest) {
        existing.latest.recovery = recovery;
        existing.latest.resolve.push(resolve);
        existing.latest.canCommit = canCommit;
      } else {
        existing.latest = { recovery, resolve: [resolve], canCommit };
      }
      return result;
    }

    const queue: MirrorQueue = { latest: null };
    mirrorQueues.set(name, queue);

    const run = (batch: MirrorBatch) => {
      const current = readRecovery(folder, name);
      const recovery =
        current?.token === batch.recovery.token && current.json === batch.recovery.json
          ? current
          : batch.recovery;
      const pending = mirrorToDisk(folder, name, recovery, loadFs, batch.canCommit);
      trackMirror(folder, name, pending);
      void pending.then((outcome) => {
        batch.resolve.forEach((settle) => settle(outcome));
        const next = queue.latest;
        queue.latest = null;
        if (next && !(outcome.succeeded === false && outcome.conflict)) run(next);
        else if (next) next.resolve.forEach((settle) => settle(outcome));
        else if (mirrorQueues.get(name) === queue) mirrorQueues.delete(name);
        if (!next || (outcome.succeeded === false && outcome.conflict)) {
          if (mirrorQueues.get(name) === queue) mirrorQueues.delete(name);
        }
      });
    };

    run({ recovery, resolve: [resolve], canCommit });
    return result;
  }

  function ensureHydrated(name: string): Promise<void> {
    if (folder === null || !isValidName(name)) return Promise.resolve();

    const startingActivationEpoch = activationEpoch();
    if (!isCapturedFolderSelected(startingActivationEpoch)) return Promise.resolve();

    const existing = hydration.get(name);
    if (existing && hydrationEpochs.get(name) === startingActivationEpoch) return existing;

    const startingGeneration = rendererGenerations.get(name) ?? 0;
    const pending = (async () => {
      try {
        if (!fileSystem) {
          const active = await reconcileNativeLocalFolder();
          if (!isCapturedFolderSelected(startingActivationEpoch)) {
            forgetHydration(name, startingActivationEpoch);
            return;
          }
          if (active.folder !== folder) {
            if (active.folder !== null && active.available) {
              await createLocalFolderStore(active.folder).hydrate?.(name);
            }
            markHydrated(name, startingActivationEpoch);
            return;
          }
          if (!active.available) {
            markHydrated(name, startingActivationEpoch);
            return;
          }
        }
        const activeFileSystem = await loadFs();
        if (!isCapturedFolderSelected(startingActivationEpoch)) {
          forgetHydration(name, startingActivationEpoch);
          return;
        }
        const cachedJson = readCachedJson(name);
        const disk = await activeFileSystem.read(folder, name);
        if (!isCapturedFolderSelected(startingActivationEpoch)) {
          forgetHydration(name, startingActivationEpoch);
          return;
        }

        // Read the journal after disk I/O as a synchronous write can create or
        // replace it while hydration is in flight.
        const recovery = readRecovery(folder, name);
        if (recovery) {
          JSON.parse(recovery.json);
          let recoverable = recovery;
          if (
            !recovery.expectedKnown &&
            recoveryTokenAwaitingBaselineByName.get(name) === recovery.token
          ) {
            // This renderer created the journal only after hydration started,
            // so this exact versioned read is its trustworthy baseline.
            recoverable = setRecoveryExpectation(recovery, disk.revision) ?? recovery;
          }

          const recoveryPending = recoverEntry(
            folder,
            name,
            recoverable,
            activeFileSystem,
            loadFs,
            disk,
            () => isCapturedFolderSelected(startingActivationEpoch)
          );
          trackMirror(folder, name, recoveryPending);
          const outcome = await recoveryPending;
          if (recoveryTokenAwaitingBaselineByName.get(name) === recovery.token) {
            recoveryTokenAwaitingBaselineByName.delete(name);
          }
          if (!isCapturedFolderSelected(startingActivationEpoch)) {
            forgetHydration(name, startingActivationEpoch);
            return;
          }
          if (!outcome.succeeded) throw outcome.error;

          if ((rendererGenerations.get(name) ?? 0) === startingGeneration) {
            commitHydratedJson(name, folder, recovery.json);
          }
          markHydrated(name, startingActivationEpoch);
          return;
        }

        if (disk.json === null) {
          const cacheOrigin = readOrigin(name);
          const legacyDirty = readLegacyDirty(name);
          // First-run migration: when this cache predates origin markers, seed
          // the currently selected vault. An owned cache is only recoverable
          // when the legacy dirty marker proves it represented an unsaved
          // write; otherwise the missing disk file is an authoritative
          // external deletion and the stale read-through cache must be
          // removed before its null revision can be confirmed.
          if (
            (cacheOrigin === null || (cacheOrigin === folder && legacyDirty?.folder === folder)) &&
            cachedJson !== null &&
            (rendererGenerations.get(name) ?? 0) === startingGeneration
          ) {
            // Validate before creating a portable file that future launches
            // would be unable to hydrate.
            JSON.parse(cachedJson);
            const seeded = requireRecovery(folder, name, cachedJson, {
              known: true,
              revision: disk.revision,
            });
            const outcome = await queueMirror(name, seeded, () =>
              isCapturedFolderSelected(startingActivationEpoch)
            );
            if (!isCapturedFolderSelected(startingActivationEpoch)) {
              forgetHydration(name, startingActivationEpoch);
              return;
            }
            if (!outcome.succeeded) throw outcome.error;
            if ((rendererGenerations.get(name) ?? 0) === startingGeneration) {
              try {
                claimCachedValue(name, folder);
              } catch (error) {
                forgetConfirmedDiskRevision(folder, name);
                throw error;
              }
            }
          } else {
            if (!isCapturedFolderSelected(startingActivationEpoch)) {
              forgetHydration(name, startingActivationEpoch);
              return;
            }
            if (cacheOrigin === folder && cachedJson !== null) {
              clearCachedValue(name, folder);
            }
            confirmDiskRevision(folder, name, disk.revision);
          }
          markHydrated(name, startingActivationEpoch);
          return;
        }

        JSON.parse(disk.json);

        // A synchronous user write that happened after hydration began wins.
        // Its own mirror is already queued, so applying stale disk data here
        // would roll the UI back and could overwrite the new value later.
        if ((rendererGenerations.get(name) ?? 0) !== startingGeneration) {
          markHydrated(name, startingActivationEpoch);
          return;
        }
        if (!isCapturedFolderSelected(startingActivationEpoch)) {
          forgetHydration(name, startingActivationEpoch);
          return;
        }

        commitHydratedJson(name, folder, disk.json);
        confirmDiskRevision(folder, name, disk.revision);
        markHydrated(name, startingActivationEpoch);
      } catch (error) {
        // A failed versioned read cannot establish the pre-edit baseline.
        // Leaving this token eligible would let a later retry adopt a remote
        // revision that appeared after the local edit and overwrite it.
        const stillCurrent = isCapturedFolderSelected(startingActivationEpoch);
        if (hydrationEpochs.get(name) === startingActivationEpoch) {
          recoveryTokenAwaitingBaselineByName.delete(name);
          if (stillCurrent) {
            reportError("hydrate", folder, name, error);
            // Do not permanently cache a failed restore. A later read (or a reload
            // after the user fixes folder permissions / malformed JSON) can retry.
            forgetConfirmedDiskRevision(folder, name);
          }
        }
        forgetHydration(name, startingActivationEpoch);
        if (!stillCurrent) return;
        throw error;
      }
    })();

    hydration.set(name, pending);
    hydrationEpochs.set(name, startingActivationEpoch);
    trackHydration(folder, name, pending);
    return pending;
  }

  async function refreshFromDisk(name: string, expectedActivationEpoch: number): Promise<void> {
    if (
      folder === null ||
      !isValidName(name) ||
      !isCapturedFolderSelected(expectedActivationEpoch)
    ) {
      return;
    }

    // Drain only this value. An unrelated conflict (for example annotations)
    // must not prevent a safe external bookmarks update from being observed.
    // This name's own recovery journal remains a fail-closed boundary.
    await flushLocalFolderStateName(folder, name);
    if (!isCapturedFolderSelected(expectedActivationEpoch)) return;
    const generation = rendererGenerations.get(name) ?? 0;
    const activeFileSystem = await loadFs();
    if (!isCapturedFolderSelected(expectedActivationEpoch)) return;
    const disk = await activeFileSystem.read(folder, name);
    if (
      !isCapturedFolderSelected(expectedActivationEpoch) ||
      generation !== (rendererGenerations.get(name) ?? 0)
    ) {
      return;
    }

    if (disk.json === null) {
      clearCachedValue(name, folder);
    } else {
      JSON.parse(disk.json);
      commitHydratedJson(name, folder, disk.json);
    }
    confirmDiskRevision(folder, name, disk.revision);

    hydrated.set(name, expectedActivationEpoch);
    hydration.set(name, Promise.resolve());
    hydrationEpochs.set(name, expectedActivationEpoch);
  }

  function writeValue<T>(name: string, value: T): Promise<MirrorOutcome> {
    const json = JSON.stringify(value);
    if (json === undefined) {
      throw new Error(`Could not serialize \"${name}\" state.`);
    }
    const recovery = folder === null ? null : requireRecovery(folder, name, json);
    const generation = (rendererGenerations.get(name) ?? 0) + 1;
    rendererGenerations.set(name, generation);

    if (folder === null) {
      web.write(name, value);
      return Promise.resolve({ succeeded: true, revision: "" });
    }
    if (!recovery) {
      return Promise.resolve({
        succeeded: false,
        conflict: false,
        error: new Error(`Could not preserve pending \"${name}\" state for recovery.`),
      });
    }
    try {
      commitCachedJson(name, folder, json);
    } catch (error) {
      reportError("update", folder, name, error);
      return Promise.resolve({
        succeeded: false,
        conflict: false,
        error,
      });
    }
    if (recovery.expectedKnown) return queueMirror(name, recovery);

    // A synchronous consumer may write before its first versioned read
    // completes. Keep the UI/cache update synchronous but delay disk I/O until
    // hydration records the baseline in this exact recovery entry.
    recoveryTokenAwaitingBaselineByName.set(name, recovery.token);
    return ensureHydrated(name).then(
      () => {
        const current = readRecovery(folder, name);
        if (!current) {
          const confirmed = getConfirmedDiskRevision(folder, name);
          return {
            succeeded: true,
            revision: confirmed.revision ?? "",
          } satisfies MirrorSuccess;
        }
        return queueMirror(name, current);
      },
      (error: unknown) => ({
        succeeded: false,
        conflict: isPortableStateConflict(error),
        error,
      })
    );
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

    async refresh(names: readonly string[]): Promise<void> {
      const refreshActivationEpoch = activationEpoch();
      if (!isCapturedFolderSelected(refreshActivationEpoch)) return;

      let firstFailure: unknown;
      for (const name of new Set(names)) {
        if (!isCapturedFolderSelected(refreshActivationEpoch)) break;
        // Native watcher paths are user-controlled through the Vault. Never
        // let an arbitrary `.verto/<name>.json` map onto application control
        // keys such as `verto:active-local-folder` or recovery metadata.
        if (!KNOWN_PORTABLE_STATE_NAME_SET.has(name)) continue;
        try {
          await refreshFromDisk(name, refreshActivationEpoch);
        } catch (error) {
          const stillCurrent = isCapturedFolderSelected(refreshActivationEpoch);
          if (hydrationEpochs.get(name) === refreshActivationEpoch) {
            forgetHydration(name, refreshActivationEpoch);
          }
          if (stillCurrent) {
            if (folder !== null) forgetConfirmedDiskRevision(folder, name);
            reportError("hydrate", folder ?? "", name, error);
            firstFailure ??= error;
          }
        }
      }
      if (firstFailure) throw firstFailure;
    },

    update<T>(name: string, fallback: T, updater: (current: T) => T): Promise<T> {
      if (!isValidName(name)) return Promise.resolve(updater(fallback));

      if (!isCapturedFolderWritable()) {
        const error = new Error("The active local library changed before state could be saved.");
        reportError("update", folder ?? "", name, error);
        return Promise.reject(error);
      }

      const apply = (): { next: T; persisted: Promise<MirrorOutcome> } => {
        if (!isCapturedFolderWritable()) {
          const error = new Error("The active local library changed before state could be saved.");
          reportError("update", folder ?? "", name, error);
          throw error;
        }
        const next = updater(readValue(name, fallback));
        return { next, persisted: writeValue(name, next) };
      };

      const settle = async ({ next, persisted }: ReturnType<typeof apply>): Promise<T> => {
        const outcome = await persisted;
        if (!outcome.succeeded) throw outcome.error;
        return next;
      };

      // Once restored, keep browser writes synchronous (notably pagehide
      // reading progress) while retaining a Promise-based API for startup.
      const currentActivationEpoch = activationEpoch();
      if (
        hydrated.get(name) === currentActivationEpoch &&
        isCapturedFolderSelected(currentActivationEpoch)
      ) {
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
