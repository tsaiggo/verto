// StateStore factory.
//
// `getStateStore()` is called at render time (not module load) so it
// re-evaluates the runtime environment on every call:
//
//   - SSR / server component → null store (no-op; no window)
//   - Tauri desktop with an active folder → localStorage + .verto/ mirror
//   - Web / desktop without an active folder → localStorage only

import { isTauri } from "@/lib/tauri";
import { loadActiveLocalFolder } from "@/lib/local-folder";

import { createWebStore } from "./web";
import { createLocalFolderStore } from "./local-folder";
import type { StateStore } from "./types";

export type { StateStore };
export {
  beginLocalFolderSwitch,
  cancelLocalFolderSwitch,
  completeLocalFolderSwitch,
  flushLocalFolderState,
  hasPendingLocalFolderRecovery,
  reconcileNativeLocalFolder,
  STATE_STORE_ERROR_EVENT,
  type NativeLocalFolderStatus,
  type StateStoreErrorDetail,
} from "./local-folder";

/** A no-op store used on the server / in SSR contexts. */
function makeNullStore(): StateStore {
  return {
    read<T>(_name: string, fallback: T): T {
      return fallback;
    },
    async hydrate(): Promise<void> {},
    async update<T>(_name: string, fallback: T, updater: (current: T) => T): Promise<T> {
      return updater(fallback);
    },
    write(): void {},
    subscribe(): () => void {
      return () => {};
    },
  };
}

let cachedLocalFolderStore: { folder: string; store: StateStore } | null = null;

/**
 * Return the appropriate StateStore for the current runtime.
 *
 * Must be called at render time so the Tauri / active-folder check is live.
 */
export function getStateStore(): StateStore {
  if (typeof window === "undefined") return makeNullStore();
  const folder = loadActiveLocalFolder();
  if (isTauri() && folder !== null) {
    if (cachedLocalFolderStore?.folder !== folder) {
      cachedLocalFolderStore = { folder, store: createLocalFolderStore(folder) };
    }
    return cachedLocalFolderStore.store;
  }
  cachedLocalFolderStore = null;
  return createWebStore();
}
