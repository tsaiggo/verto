// Shared helpers for talking to the Tauri desktop shell.
//
// Verto uses the shell for native file access and a CORS-safe HTTP client for
// configured assistant requests. Every helper degrades safely in the browser.
/** Minimal structural type for the global fetch, used for dependency injection. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const pendingMarkdownWrites = new Map<string, Set<Promise<void>>>();
const frozenMarkdownRoots = new Set<string>();

function trackMarkdownWrite(root: string, pending: Promise<void>): void {
  const writes = pendingMarkdownWrites.get(root) ?? new Set<Promise<void>>();
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

/**
 * Write `content` to a `.md` / `.mdx` file inside the selected `root` on the
 * host filesystem. Parent directories are created automatically. The Rust
 * command resolves both paths and rejects traversal or symlink escapes, as
 * well as non-Markdown extensions.
 * Throws a clear error when called outside Tauri.
 */
export function writeLocalFile(root: string, id: string, content: string): Promise<void> {
  if (frozenMarkdownRoots.has(root)) {
    return Promise.reject(
      new Error("The active local library is changing. Wait for it to finish, then save again.")
    );
  }
  const pending = tauriInvoke<void>("write_local_file", { root, id, content });
  trackMarkdownWrite(root, pending);
  return pending;
}

/** Read one validated JSON state file from the active authorized library. */
export async function readVaultState(root: string, name: string): Promise<string | null> {
  return tauriInvoke<string | null>("read_vault_state", { root, name });
}

/** Atomically write one validated JSON state file inside the active library. */
export async function writeVaultState(root: string, name: string, json: string): Promise<void> {
  return tauriInvoke<void>("write_vault_state", { root, name, json });
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
