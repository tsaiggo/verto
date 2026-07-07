// Web / localhost backend for the StateStore abstraction.
//
// Persists to localStorage with keys prefixed `verto:<name>`.
// Notifies same-tab listeners via a dispatched StorageEvent (falling back to a
// plain Event when StorageEvent is unavailable). Cross-tab changes arrive as
// native storage events; we filter to our namespace in `subscribe()`.
//
// Pattern mirrors lib/inbox.ts and lib/ai/key-store.ts.

import type { StateStore } from "./types";

function storageKey(name: string): string {
  return `verto:${name}`;
}

export function createWebStore(): StateStore {
  return {
    read<T>(name: string, fallback: T): T {
      if (typeof window === "undefined" || !window.localStorage) return fallback;
      try {
        const raw = window.localStorage.getItem(storageKey(name));
        if (raw === null) return fallback;
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },

    write<T>(name: string, value: T): void {
      if (typeof window === "undefined" || !window.localStorage) return;
      const key = storageKey(name);
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Quota or disabled storage — persistence is best-effort.
        return;
      }
      const event =
        typeof StorageEvent === "function"
          ? new StorageEvent("storage", { key })
          : new Event("storage");
      window.dispatchEvent(event);
    },

    subscribe(listener: () => void): () => void {
      if (typeof window === "undefined") return () => {};
      // Duck-type: StorageEvent has a `key` property; plain Event does not.
      // Filter out storage changes from other namespaces so unrelated
      // localStorage writes (e.g. third-party scripts) don't trigger re-renders.
      const handler = (event: Event): void => {
        const key = (event as { key?: string | null }).key;
        if (typeof key === "string" && !key.startsWith("verto:")) return;
        listener();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
  };
}
