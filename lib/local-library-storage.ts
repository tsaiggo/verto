/** Shared storage primitives for managed articles and imported reading files. */
export const LIBRARY_DATABASE_NAME = "verto.articles";
export const LIBRARY_DATABASE_VERSION = 2;
export const ARTICLE_STORE = "articles";
export const DOCUMENT_STORE = "documents";
export const DOCUMENT_BYTES_STORE = "document-bytes";
const CHANGE_EVENT = "verto:articles-changed";
const CHANGE_STORAGE_KEY = "verto.articles.changed";
let fallbackId = 0;

export function localDocumentId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `article-${Date.now().toString(36)}-${++fallbackId}-${Math.random().toString(36).slice(2)}`;
}

export function openLibraryDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof globalThis.indexedDB === "undefined") {
      reject(new Error("Browser library storage is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(LIBRARY_DATABASE_NAME, LIBRARY_DATABASE_VERSION);
    let blocked = false;
    request.onupgradeneeded = () => {
      // The version-one article store is preserved byte-for-byte during upgrade.
      for (const name of [ARTICLE_STORE, DOCUMENT_STORE]) {
        if (!request.result.objectStoreNames.contains(name))
          request.result.createObjectStore(name, { keyPath: "id" });
      }
      if (!request.result.objectStoreNames.contains(DOCUMENT_BYTES_STORE))
        request.result.createObjectStore(DOCUMENT_BYTES_STORE);
    };
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error("Library storage could not open."));
    request.onblocked = () => {
      blocked = true;
      reject(
        new Error("Library storage is blocked by another browser window. Close it and retry.")
      );
    };
  });
}

export function validExpectedRevision(revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 0)
    throw new Error("A valid expected document revision is required.");
}

/** Notifications never convert a committed transaction into a reported failure. */
export function notifyLocalLibraryChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
  try {
    const channel = new BroadcastChannel(CHANGE_EVENT);
    channel.postMessage("changed");
    channel.close();
  } catch {
    /* Current-window notifications still work. */
  }
  try {
    window.localStorage.setItem(CHANGE_STORAGE_KEY, localDocumentId());
  } catch {
    /* A blocked event fallback must not affect stored content. */
  }
}

export function subscribeLocalLibrary(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const refresh = () => callback();
  const storage = (event: StorageEvent) => {
    if (event.key === CHANGE_STORAGE_KEY || event.key === null) refresh();
  };
  let channel: BroadcastChannel | undefined;
  try {
    channel = new BroadcastChannel(CHANGE_EVENT);
    channel.onmessage = refresh;
  } catch {
    /* Storage events remain as a fallback. */
  }
  window.addEventListener(CHANGE_EVENT, refresh);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, refresh);
    window.removeEventListener("storage", storage);
    channel?.close();
  };
}
