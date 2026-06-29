// Browser-only API-key store for the web build.
//
// On the desktop app the assistant reuses the GitHub OAuth token obtained
// through the device flow (held in the auth file, never in the repo). The web
// build has no such token and the browser blocks cross-origin GitHub calls, so
// as a graceful fallback users may paste a GitHub token / API key which we keep
// in `localStorage` only — it is never written to the repository or sent
// anywhere except the configured inference endpoint.

const STORAGE_KEY = "verto:assistant:token";

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    // localStorage can throw in private-mode / sandboxed contexts.
    return null;
  }
}

/** Read the saved key, or null when none / unavailable. */
export function loadWebKey(): string | null {
  const store = storage();
  if (!store) return null;
  const value = store.getItem(STORAGE_KEY);
  return value && value.trim() ? value.trim() : null;
}

/** Persist a key. A blank value clears it. */
export function saveWebKey(value: string): void {
  const store = storage();
  if (!store) return;
  const trimmed = value.trim();
  if (trimmed) {
    store.setItem(STORAGE_KEY, trimmed);
  } else {
    store.removeItem(STORAGE_KEY);
  }
  notifyWebKeyChanged();
}

/** Remove the saved key. */
export function clearWebKey(): void {
  storage()?.removeItem(STORAGE_KEY);
  notifyWebKeyChanged();
}

/** Notify same-tab listeners that the key changed; panels re-read on this. */
export function notifyWebKeyChanged(): void {
  if (typeof window === "undefined") return;
  const event =
    typeof StorageEvent === "function"
      ? new StorageEvent("storage", { key: STORAGE_KEY })
      : new Event("storage");
  window.dispatchEvent(event);
}
