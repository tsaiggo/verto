// Shared helpers for talking to the Tauri desktop shell.
//
// Verto uses the shell for native file access and a CORS-safe HTTP client for
// configured assistant requests. Every helper degrades safely in the browser.
/** Minimal structural type for the global fetch, used for dependency injection. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

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
 * Uses `@tauri-apps/plugin-dialog`, whose `open({ directory: true })` defers to
 * the operating system's folder chooser. Verto reads content at build time, so
 * the returned path is surfaced in the UI (and is what the user would set via
 * `VERTO_LOCAL_DIR`) rather than swapped in live.
 */
export async function pickFolder(): Promise<string | null> {
  if (!isTauri()) {
    throw new Error("Choosing a folder is only available in the Verto desktop app.");
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({ directory: true, multiple: false });
  return typeof selected === "string" ? selected : null;
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

export async function readLocalFile(id: string): Promise<string> {
  return tauriInvoke<string>("read_local_file", { id });
}

/**
 * Write `content` to a `.md` / `.mdx` file at the given absolute path on
 * the host filesystem. Parent directories are created automatically. Only
 * `.md` and `.mdx` extensions are accepted — the Rust command rejects
 * anything else so this cannot be used as a general-purpose file writer.
 * Throws a clear error when called outside Tauri.
 */
export async function writeLocalFile(id: string, content: string): Promise<void> {
  return tauriInvoke<void>("write_local_file", { id, content });
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
