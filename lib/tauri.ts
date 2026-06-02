// Shared helpers for talking to the Tauri desktop shell.
//
// Verto ships both as a static web build and as a Tauri 2 desktop app. The
// GitHub-login / connect-repo flow is desktop-only: it needs to make
// cross-origin calls to GitHub (which the browser blocks via CORS) and to
// persist credentials to a host file the web build can't touch.
//
// Everything here degrades gracefully in the browser: `isTauri()` returns
// false and the higher-level auth code hides itself, so importing this module
// from shared components is safe.

/** Minimal structural type for the global fetch, used for dependency injection. */
export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

/**
 * True when running inside the Tauri runtime (the desktop shell), false in a
 * plain browser. Tauri 2 exposes `__TAURI_INTERNALS__`; older markers used
 * `__TAURI__`. We look for either for safety.
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.__TAURI_INTERNALS__ ?? w.__TAURI__);
}

/**
 * Invoke a Rust command exposed by the desktop shell. Throws a clear error
 * when called outside Tauri so callers fail loudly instead of silently no-op.
 */
export async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauri()) {
    throw new Error(
      `tauriInvoke("${command}") is only available in the Verto desktop app.`,
    );
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

/**
 * A `fetch` implementation suitable for calling GitHub from the desktop app.
 *
 * Inside Tauri we use `@tauri-apps/plugin-http`, whose requests originate from
 * the Rust process and therefore bypass the webview's CORS restrictions —
 * essential for `github.com/login/device/code` and the GitHub REST API, which
 * don't send `Access-Control-Allow-Origin` headers. In the browser we fall
 * back to the global `fetch` (used only in tests / web preview).
 */
export async function tauriFetch(): Promise<FetchLike> {
  if (isTauri()) {
    const { fetch: httpFetch } = await import("@tauri-apps/plugin-http");
    return httpFetch as unknown as FetchLike;
  }
  return fetch as FetchLike;
}
