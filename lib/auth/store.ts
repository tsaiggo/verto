// Local auth store — desktop only.
//
// The signed-in GitHub token, the user's profile and the currently-connected
// repository are persisted to a file on the host (outside the repo) by the
// Tauri shell. The Rust side owns the file location and permissions; this
// module is a thin, JSON-typed wrapper over the three commands it exposes:
//
//   auth_save(data: string)  → write the JSON blob
//   auth_load() -> string?   → read it back (null when absent)
//   auth_clear()             → delete it (sign out)
//
// Everything no-ops gracefully outside Tauri so the web build can import the
// AuthProvider without crashing.

import { isTauri, tauriInvoke } from "@/lib/tauri";
import type { GitHubUser } from "@/lib/auth/github-api";

/** The repository connection the user has chosen to read content from. */
export interface RepoConnection {
  /** `owner/repo`. */
  repo: string;
  /** Branch to read from. */
  branch: string;
  /** Content sub-path within the repo (no leading slash; "" = repo root). */
  path: string;
}

/** Everything persisted to the host auth file. */
export interface StoredAuth {
  /** OAuth access token from the device flow. */
  token: string;
  /** Cached GitHub profile for display. */
  user: GitHubUser;
  /** The connected repository, once the user completes the connect flow. */
  connection?: RepoConnection;
}

/**
 * Load the persisted auth blob, or null when signed out / not in the desktop
 * app. Never throws on a missing file or a browser context.
 */
export async function loadAuth(): Promise<StoredAuth | null> {
  if (!isTauri()) return null;
  try {
    const raw = await tauriInvoke<string | null>("auth_load");
    if (!raw) return null;
    return JSON.parse(raw) as StoredAuth;
  } catch {
    // A corrupt or unreadable file shouldn't brick the UI — treat as signed out.
    return null;
  }
}

/** Persist the auth blob to the host file. No-op outside Tauri. */
export async function saveAuth(auth: StoredAuth): Promise<void> {
  if (!isTauri()) return;
  await tauriInvoke<void>("auth_save", { data: JSON.stringify(auth) });
}

/** Delete the persisted auth blob (sign out). No-op outside Tauri. */
export async function clearAuth(): Promise<void> {
  if (!isTauri()) return;
  await tauriInvoke<void>("auth_clear");
}
