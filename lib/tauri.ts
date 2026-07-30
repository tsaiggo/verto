// Shared helpers for talking to the Tauri desktop shell.
//
// Verto uses the shell for native file access and a CORS-safe HTTP client for
// configured assistant requests. Every helper degrades safely in the browser.
import type { RawFileEntry } from "./content-source";

/** Minimal structural type for the global fetch, used for dependency injection. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const pendingMarkdownWrites = new Map<string, Set<Promise<unknown>>>();
const frozenMarkdownRoots = new Set<string>();

function trackMarkdownWrite(root: string, pending: Promise<unknown>): void {
  const writes = pendingMarkdownWrites.get(root) ?? new Set<Promise<unknown>>();
  writes.add(pending);
  pendingMarkdownWrites.set(root, writes);
  const remove = () => {
    writes.delete(pending);
    if (writes.size === 0) pendingMarkdownWrites.delete(root);
  };
  void pending.then(remove, remove);
}

/** Freeze new Markdown saves and wait for every already-started save. */
export async function beginLocalFileWriteHandoff(root: string): Promise<string> {
  frozenMarkdownRoots.add(root);
  try {
    while (true) {
      const pending = [...(pendingMarkdownWrites.get(root) ?? [])];
      if (pending.length === 0) return root;
      await Promise.all(pending);
    }
  } catch (error) {
    frozenMarkdownRoots.delete(root);
    throw error;
  }
}

/** Re-open a root when its replacement could not be activated. */
export function cancelLocalFileWriteHandoff(root: string | null): void {
  if (root !== null) frozenMarkdownRoots.delete(root);
}

/** Allow saves to the canonical root returned by native activation. */
export function completeLocalFileWriteHandoff(root: string): void {
  frozenMarkdownRoots.delete(root);
}

/**
 * True when running inside the Tauri runtime (the desktop shell), false in a
 * plain browser. Tauri 2 exposes `__TAURI_INTERNALS__`; older markers used
 * `__TAURI__`. We look for either for safety.
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  };
  return Boolean(w.__TAURI_INTERNALS__ ?? w.__TAURI__);
}

/**
 * Invoke a Rust command exposed by the desktop shell. Throws a clear error
 * when called outside Tauri so callers fail loudly instead of silently no-op.
 */
export async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error(`tauriInvoke("${command}") is only available in the Verto desktop app.`);
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

/**
 * Open the native folder picker and return the chosen directory's absolute
 * path, or `null` when the user cancels. Desktop-only: throws a clear error in
 * the browser, where there is no access to the host filesystem.
 *
 * The dedicated Rust command opens the chooser and records the canonical root
 * in Verto's native authorization registry. A renderer-provided path can never
 * grant itself filesystem access.
 */
export async function pickFolder(): Promise<string | null> {
  if (!isTauri()) {
    throw new Error("Choosing a folder is only available in the Verto desktop app.");
  }
  return tauriInvoke<string | null>("pick_local_library");
}

export interface ActiveLocalLibraryStatus {
  folder: string | null;
  available: boolean;
  rendererMatchesActive: boolean;
}

export interface ActivatedLocalLibrary {
  folder: string;
  inspection: import("./local-folder").FolderInspection;
}

export const VAULT_WATCH_EVENT_NAME = "verto://vault-watch";
export const VAULT_WATCH_STATUS_EVENT_NAME = "verto://vault-watch-status";

export interface VaultWatchSession {
  schemaVersion: 1;
  root: string;
  generation: number;
  sequence: number;
}

export interface VaultWatchEntry extends RawFileEntry {
  sha: string;
  size: number;
  mtime: number;
}

export type VaultWatchChange =
  | { kind: "upsert"; entry: VaultWatchEntry }
  | { kind: "remove"; id: string; path: string[] }
  | {
      kind: "rename";
      fromId: string;
      fromPath: string[];
      entry: VaultWatchEntry;
    };

export interface VaultWatchBatch extends VaultWatchSession {
  rescan: boolean;
  changes: VaultWatchChange[];
  portableStateRescan: boolean;
  portableStateNames: string[];
}

export type VaultWatchAvailability = "available" | "degraded";

export interface VaultWatchStatus {
  schemaVersion: 1;
  root: string;
  generation: number;
  status: VaultWatchAvailability;
  error?: string;
}

export type VaultWatchUnlisten = () => void;

/** Start one native recursive watcher for the active authorized Vault. */
export async function startVaultWatch(root: string): Promise<VaultWatchSession> {
  return tauriInvoke<VaultWatchSession>("start_vault_watch", { root });
}

/** Stop only the still-current generation; stale cleanups are harmless. */
export async function stopVaultWatch(generation: number): Promise<void> {
  return tauriInvoke<void>("stop_vault_watch", { generation });
}

/**
 * Subscribe to native watcher batches. The returned function is Tauri's real
 * unlisten handle and must be called when the owning React effect unmounts.
 */
export async function listenVaultWatch(
  listener: (batch: VaultWatchBatch) => void
): Promise<VaultWatchUnlisten> {
  if (!isTauri()) {
    throw new Error("Vault watching is only available in the Verto desktop app.");
  }
  const { listen } = await import("@tauri-apps/api/event");
  return listen<VaultWatchBatch>(VAULT_WATCH_EVENT_NAME, (event) => listener(event.payload));
}

/** Subscribe to native watcher health transitions for the active generation. */
export async function listenVaultWatchStatus(
  listener: (status: VaultWatchStatus) => void
): Promise<VaultWatchUnlisten> {
  if (!isTauri()) {
    throw new Error("Vault watching is only available in the Verto desktop app.");
  }
  const { listen } = await import("@tauri-apps/api/event");
  return listen<VaultWatchStatus>(VAULT_WATCH_STATUS_EVENT_NAME, (event) =>
    listener(event.payload)
  );
}

export function isVaultWatchBatch(value: unknown): value is VaultWatchBatch {
  if (typeof value !== "object" || value === null) return false;
  const batch = value as Partial<VaultWatchBatch>;
  return (
    isVaultWatchSessionPayload(batch) &&
    isVaultWatchContentPayload(batch) &&
    typeof batch.portableStateRescan === "boolean" &&
    Array.isArray(batch.portableStateNames) &&
    batch.portableStateNames.every(
      (name) => typeof name === "string" && PORTABLE_STATE_NAME_PATTERN.test(name)
    )
  );
}

const PORTABLE_STATE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

function isVaultWatchSessionPayload(batch: Partial<VaultWatchBatch>): boolean {
  return (
    batch.schemaVersion === 1 &&
    typeof batch.root === "string" &&
    Number.isSafeInteger(batch.generation) &&
    (batch.generation ?? 0) > 0 &&
    Number.isSafeInteger(batch.sequence) &&
    (batch.sequence ?? -1) >= 0
  );
}

function isVaultWatchContentPayload(batch: Partial<VaultWatchBatch>): boolean {
  return (
    typeof batch.rescan === "boolean" &&
    Array.isArray(batch.changes) &&
    batch.changes.every(isVaultWatchChange)
  );
}

function isStringPath(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((segment) => typeof segment === "string");
}

function isVaultWatchEntry(value: unknown): value is VaultWatchEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<VaultWatchEntry>;
  return (
    typeof entry.id === "string" &&
    isStringPath(entry.path) &&
    typeof entry.sha === "string" &&
    Number.isSafeInteger(entry.size) &&
    (entry.size ?? -1) >= 0 &&
    Number.isSafeInteger(entry.mtime) &&
    (entry.mtime ?? -1) >= 0
  );
}

function isVaultWatchChange(value: unknown): value is VaultWatchChange {
  if (typeof value !== "object" || value === null) return false;
  const change = value as Partial<VaultWatchChange>;
  if (change.kind === "upsert") {
    return isVaultWatchEntry(change.entry);
  }
  if (change.kind === "remove") {
    return typeof change.id === "string" && isStringPath(change.path);
  }
  if (change.kind === "rename") {
    return (
      typeof change.fromId === "string" &&
      isStringPath(change.fromPath) &&
      isVaultWatchEntry(change.entry)
    );
  }
  return false;
}

export function isVaultWatchStatus(value: unknown): value is VaultWatchStatus {
  if (typeof value !== "object" || value === null) return false;
  const status = value as Partial<VaultWatchStatus>;
  return (
    status.schemaVersion === 1 &&
    typeof status.root === "string" &&
    Number.isSafeInteger(status.generation) &&
    (status.generation ?? 0) > 0 &&
    (status.status === "available" || status.status === "degraded") &&
    (status.error === undefined || typeof status.error === "string") &&
    (status.status !== "degraded" || typeof status.error === "string")
  );
}

/** Return the native registry's active canonical library and its availability. */
export async function getActiveLocalLibrary(
  rendererFolder: string | null = null
): Promise<ActiveLocalLibraryStatus> {
  return tauriInvoke<ActiveLocalLibraryStatus>("get_active_local_library", {
    rendererFolder,
  });
}

/** Activate a library that was previously authorized through the native picker. */
export async function activateLocalLibrary(folder: string): Promise<ActivatedLocalLibrary> {
  return tauriInvoke<ActivatedLocalLibrary>("activate_local_library", {
    folder,
  });
}

/**
 * Scan a folder on the host filesystem for readable `.md` / `.mdx` files and
 * report whether it exists, whether it is a directory, how many readable files
 * it holds and a few sample relative paths. Desktop-only: throws a clear error
 * in the browser, which has no filesystem access.
 *
 * Defers to the `inspect_local_dir` Rust command (see `src-tauri/src/lib.rs`),
 * which walks the directory using the same rules as the build-time local
 * source (skip dotfiles, match `.md` / `.mdx`). Used to give the "Local Library"
 * panel real feedback after a folder is chosen.
 */
export async function inspectFolder(
  folder: string
): Promise<import("./local-folder").FolderInspection> {
  return tauriInvoke<import("./local-folder").FolderInspection>("inspect_local_dir", { folder });
}

/**
 * List every readable `.md` / `.mdx` file beneath a host folder at desktop
 * runtime. The Rust shell returns entries in the same lightweight shape the
 * runtime tree builder already consumes for local folders.
 */
export async function listLocalFolder(
  folder: string
): Promise<import("./content-source").RawFileEntry[]> {
  return tauriInvoke<import("./content-source").RawFileEntry[]>("list_local_dir", { folder });
}

/** Read a Markdown file only when its resolved path stays inside `root`. */
export async function readLocalFile(root: string, id: string): Promise<string> {
  return tauriInvoke<string>("read_local_file", { root, id });
}

export interface VersionedLocalFile {
  source: string;
  revision: string;
}

export interface LocalFileWriteReceipt {
  revision: string;
}

export interface LocalFileWriteOptions {
  /** Revision captured when this exact file was opened. Null means it did not exist. */
  expectedRevision: string | null;
  /** Bypass the revision comparison only after an explicit user decision. */
  force?: boolean;
}

type LocalFileWriteOutcome =
  | { status: "saved"; revision: string }
  | {
      status: "conflict";
      expectedRevision: string | null;
      actualRevision: string | null;
    };

export class LocalFileWriteConflictError extends Error {
  readonly code = "LOCAL_FILE_WRITE_CONFLICT";

  constructor(
    readonly expectedRevision: string | null,
    readonly actualRevision: string | null
  ) {
    super(
      "This file changed on disk after you opened it. Reload the disk version or explicitly overwrite it."
    );
    this.name = "LocalFileWriteConflictError";
  }
}

export function isLocalFileWriteConflict(error: unknown): error is LocalFileWriteConflictError {
  return (
    error instanceof LocalFileWriteConflictError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "LOCAL_FILE_WRITE_CONFLICT")
  );
}

/** Read a file and the opaque content revision required for a safe later save. */
export async function readLocalFileVersioned(
  root: string,
  id: string
): Promise<VersionedLocalFile> {
  return tauriInvoke<VersionedLocalFile>("read_local_file_versioned", { root, id });
}

/**
 * Write `content` to a `.md` / `.mdx` file inside the selected `root` on the
 * host filesystem. Parent directories are created automatically. The Rust
 * command resolves both paths and rejects traversal or symlink escapes, as
 * well as non-Markdown extensions.
 *
 * Existing files require the revision captured by `readLocalFileVersioned`.
 * A mismatch returns a structured conflict and never reaches the atomic
 * replacement. `force` is reserved for an explicit user recovery action.
 * Throws a clear error when called outside Tauri.
 */
export function writeLocalFile(
  root: string,
  id: string,
  content: string,
  options: LocalFileWriteOptions = { expectedRevision: null }
): Promise<LocalFileWriteReceipt> {
  if (frozenMarkdownRoots.has(root)) {
    return Promise.reject(
      new Error("The active local library is changing. Wait for it to finish, then save again.")
    );
  }
  const pending = tauriInvoke<LocalFileWriteOutcome>("write_local_file", {
    root,
    id,
    content,
    expectedRevision: options.expectedRevision,
    force: options.force ?? false,
  }).then((outcome) => {
    if (outcome.status === "conflict") {
      throw new LocalFileWriteConflictError(outcome.expectedRevision, outcome.actualRevision);
    }
    return { revision: outcome.revision };
  });
  trackMarkdownWrite(root, pending);
  return pending;
}

export interface VersionedVaultState {
  json: string | null;
  revision: string | null;
}

export interface VaultStateWriteReceipt {
  revision: string;
}

export interface VaultStateWriteOptions {
  /** Revision observed by the versioned read. Null means the file was absent. */
  expectedRevision: string | null;
  /** Stable renderer/device identity used to scope conflict-copy retention. */
  writerId: string;
  /** Recovery journal identity, never the portable JSON payload itself. */
  recoveryToken: string;
}

type VaultStateWriteOutcome =
  | { status: "saved"; revision: string }
  | {
      status: "conflict";
      expectedRevision: string | null;
      actualRevision: string | null;
      conflictPath: string | null;
      preservationError: string | null;
    };

export class VaultStateWriteConflictError extends Error {
  readonly code = "PORTABLE_STATE_CONFLICT";

  constructor(
    readonly expectedRevision: string | null,
    readonly actualRevision: string | null,
    readonly conflictPath?: string,
    readonly preservationError?: string
  ) {
    super(
      conflictPath
        ? `Portable state changed on disk. The local recovery payload was preserved at ${conflictPath}.`
        : "Portable state changed on disk. The local recovery journal was retained."
    );
    this.name = "VaultStateWriteConflictError";
  }
}

export function isVaultStateWriteConflict(error: unknown): error is VaultStateWriteConflictError {
  return (
    error instanceof VaultStateWriteConflictError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "PORTABLE_STATE_CONFLICT")
  );
}

/** Read validated portable JSON together with its opaque on-disk revision. */
export async function readVaultStateVersioned(
  root: string,
  name: string
): Promise<VersionedVaultState> {
  return tauriInvoke<VersionedVaultState>("read_vault_state_versioned", { root, name });
}

/**
 * Compare and atomically replace one portable state file.
 *
 * A mismatched revision never overwrites the canonical file. The native shell
 * attempts to preserve the local recovery payload under `.verto/conflicts`
 * before this helper throws a structured conflict.
 */
export async function writeVaultStateIfRevision(
  root: string,
  name: string,
  json: string,
  options: VaultStateWriteOptions
): Promise<VaultStateWriteReceipt> {
  const outcome = await tauriInvoke<VaultStateWriteOutcome>("write_vault_state_if_revision", {
    root,
    name,
    json,
    expectedRevision: options.expectedRevision,
    writerId: options.writerId,
    recoveryToken: options.recoveryToken,
  });
  if (outcome.status === "conflict") {
    throw new VaultStateWriteConflictError(
      outcome.expectedRevision,
      outcome.actualRevision,
      outcome.conflictPath ?? undefined,
      outcome.preservationError ?? undefined
    );
  }
  return { revision: outcome.revision };
}

/**
 * A fetch implementation suitable for assistant requests from the desktop app.
 *
 * Inside Tauri the HTTP plugin bypasses webview CORS restrictions. In the
 * browser, this falls back to the global fetch implementation.
 */ export async function tauriFetch(): Promise<FetchLike> {
  if (isTauri()) {
    const { fetch: httpFetch } = await import("@tauri-apps/plugin-http");
    return httpFetch as unknown as FetchLike;
  }
  return fetch as FetchLike;
}
