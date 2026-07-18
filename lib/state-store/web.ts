// Web / localhost backend for the StateStore abstraction.
//
// Persists to localStorage with keys prefixed `verto:<name>`.
// Notifies same-tab listeners via a dispatched StorageEvent (falling back to a
// plain Event when StorageEvent is unavailable). Cross-tab changes arrive as
// native storage events; we filter to our namespace in `subscribe()`.
//
// Pattern mirrors lib/inbox.ts and lib/ai/key-store.ts.

import type { StateStore } from "./types";

export class WebStatePersistenceError extends Error {
  readonly cause: unknown;

  constructor(storeName: string, cause: unknown) {
    super(`Could not persist "${storeName}" in browser storage.`);
    this.name = "WebStatePersistenceError";
    this.cause = cause;
  }
}

function storageKey(name: string): string {
  return `verto:${name}`;
}

export function createWebStore(): StateStore {
  return {
    read<T>(name: string, fallback: T): T {
      if (typeof window === "undefined") return fallback;
      try {
        const storage = window.localStorage;
        if (!storage) return fallback;
        const raw = storage.getItem(storageKey(name));
        if (raw === null) return fallback;
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },

    async hydrate(): Promise<void> {},

    async update<T>(name: string, fallback: T, updater: (current: T) => T): Promise<T> {
      const current = this.read(name, fallback);
      const next = updater(current);
      this.write(name, next);
      return next;
    },

    write<T>(name: string, value: T): void {
      if (typeof window === "undefined") return;
      const key = storageKey(name);
      try {
        const storage = window.localStorage;
        if (!storage) throw new Error("Browser storage is unavailable.");
        const serialized = JSON.stringify(value);
        if (serialized === undefined) throw new TypeError("The value is not serializable.");
        storage.setItem(key, serialized);
      } catch (cause) {
        throw new WebStatePersistenceError(name, cause);
      }
      if (typeof window.dispatchEvent === "function") {
        const event =
          typeof StorageEvent === "function"
            ? new StorageEvent("storage", { key })
            : new Event("storage");
        window.dispatchEvent(event);
      }
    },

    subscribe(listener: () => void): () => void {
      if (
        typeof window === "undefined" ||
        typeof window.addEventListener !== "function" ||
        typeof window.removeEventListener !== "function"
      ) {
        return () => {};
      }
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
