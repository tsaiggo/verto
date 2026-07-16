import type { RawFileEntry } from "./content-source";
import {
  canUseBrowserLocalPicker,
  hasBrowserLocalFolder,
  isBrowserLocalFileId,
  listBrowserLocalFolder,
  pickBrowserLocalFolder,
  readBrowserLocalFile,
} from "./browser-local-folder";
import type { FolderInspection } from "./local-folder";
import { loadActiveLocalFolder, saveActiveLocalFolder } from "./local-folder";
import {
  beginLocalFolderSwitch,
  cancelLocalFolderSwitch,
  completeLocalFolderSwitch,
  hasPendingLocalFolderRecovery,
  reconcileNativeLocalFolder,
} from "./state-store";
import {
  activateLocalLibrary,
  beginLocalFileWriteHandoff,
  cancelLocalFileWriteHandoff,
  completeLocalFileWriteHandoff,
  isTauri,
  listLocalFolder,
  pickFolder,
  readLocalFile,
} from "./tauri";

export type RuntimeLocalPickerMode = "desktop" | "browser" | "unavailable";

/**
 * A renderer-owned opt-out from the native registry's last authorized root.
 *
 * Tauri intentionally remembers authorized folders so reconnecting does not
 * require another permission prompt. Disconnecting in Verto therefore keeps
 * that authorization, but records that the folder must not be restored as the
 * active Library until the user explicitly connects it again.
 */
export const RUNTIME_LOCAL_DISCONNECTED_KEY = "verto:runtime-local-folder-disconnected";

export interface RuntimeLocalFolderSelection {
  folder: string;
  inspection: FolderInspection | null;
  mode: Exclude<RuntimeLocalPickerMode, "unavailable">;
}

export function runtimeLocalPickerMode(): RuntimeLocalPickerMode {
  if (isTauri()) return "desktop";
  return canUseBrowserLocalPicker() ? "browser" : "unavailable";
}

export function canChooseRuntimeLocalFolder(): boolean {
  return runtimeLocalPickerMode() !== "unavailable";
}

export function loadActiveRuntimeLocalFolder(): string | null {
  if (runtimeLocalFolderIsDisconnected()) {
    // Native reconciliation may have restored its last authorized root during
    // startup. Keep the renderer inactive while the persisted opt-out is set.
    if (loadActiveLocalFolder()) saveActiveLocalFolder("");
    return null;
  }
  const folder = loadActiveLocalFolder();
  if (!folder) return null;
  if (isTauri()) return folder;
  return hasBrowserLocalFolder(folder) ? folder : null;
}

let localFolderActivationQueue: Promise<void> = Promise.resolve();

function persistActiveFolder(folder: string): void {
  const wasDisconnected = runtimeLocalFolderIsDisconnected();
  setRuntimeLocalFolderDisconnected(false);
  if (!saveActiveLocalFolder(folder)) {
    setRuntimeLocalFolderDisconnected(wasDisconnected);
    throw new Error("Could not remember the active local library in renderer storage.");
  }
}

/**
 * Ask the user for a folder without changing the active Library.
 *
 * Desktop selection grants native access; browser selection caches readable
 * files for preview. The caller must explicitly call
 * {@link activateRuntimeLocalFolder} to connect the selection.
 */
export async function chooseRuntimeLocalFolder(): Promise<RuntimeLocalFolderSelection | null> {
  if (isTauri()) {
    const folder = await pickFolder();
    if (!folder) return null;
    return {
      folder,
      inspection: null,
      mode: "desktop",
    };
  }

  const selection = await pickBrowserLocalFolder();
  if (!selection) return null;
  return {
    folder: selection.folder,
    inspection: selection.inspection,
    mode: "browser",
  };
}

/**
 * Durably hand off from the current native root to an already authorized one.
 * New writes to the old store are frozen before its queue is drained, closing
 * the gap between the final mirror and the native activation IPC.
 */
export function activateRuntimeLocalFolder(folder: string): Promise<FolderInspection> {
  const activation = localFolderActivationQueue.then(() => activateRuntimeLocalFolderNow(folder));
  localFolderActivationQueue = activation.then(
    () => undefined,
    () => undefined
  );
  return activation;
}

async function activateRuntimeLocalFolderNow(folder: string): Promise<FolderInspection> {
  if (!isTauri()) {
    if (!hasBrowserLocalFolder(folder)) {
      throw new Error("Choose this folder again so the browser can access its files.");
    }
    const entries = await listBrowserLocalFolder(folder);
    persistActiveFolder(folder);
    return {
      exists: true,
      isDir: true,
      fileCount: entries.length,
      samples: entries.slice(0, 5).map((entry) => entry.path.join("/")),
    };
  }

  const native = await reconcileNativeLocalFolder();
  const previousFiles =
    native.folder === null ? null : await beginLocalFileWriteHandoff(native.folder);
  let activatedFolder: string | null = null;

  try {
    // A missing active root can be abandoned only when it has no acknowledged
    // state left to recover. The selected replacement is already authorized by
    // the native picker, so activate it before asking its store to recover.
    if (native.folder === null || !native.available) {
      if (native.folder !== null && hasPendingLocalFolderRecovery(native.folder)) {
        throw new Error(
          "The previous local library is unavailable and still has pending portable state. Reconnect it before opening another library."
        );
      }
      const activated = await activateLocalLibrary(folder);
      activatedFolder = activated.folder;
      persistActiveFolder(activated.folder);
      await beginLocalFolderSwitch(activated.folder);
      completeLocalFolderSwitch(activated.folder);
      completeLocalFileWriteHandoff(activated.folder);
      return activated.inspection;
    }

    await beginLocalFolderSwitch(native.folder);
    const activated = await activateLocalLibrary(folder);
    activatedFolder = activated.folder;
    persistActiveFolder(activated.folder);
    completeLocalFolderSwitch(activated.folder);
    completeLocalFileWriteHandoff(activated.folder);
    return activated.inspection;
  } catch (error) {
    if (activatedFolder !== null) {
      // Native activation is already committed and cannot be rolled back here.
      // Re-open the actual active root, which may still be frozen from a prior
      // handoff, while keeping the no-longer-active root closed to stale writes.
      completeLocalFolderSwitch(activatedFolder);
      completeLocalFileWriteHandoff(activatedFolder);
    } else {
      cancelLocalFolderSwitch(native.folder);
      cancelLocalFileWriteHandoff(previousFiles);
    }
    throw error;
  }
}

/**
 * Stop using the runtime local library without deleting files, browser cache,
 * recent-folder history, or portable `.verto` state.
 *
 * On desktop, new Markdown and portable-state writes are frozen first and all
 * writes already in flight are drained before the renderer drops the active
 * root. The native authorization is retained solely so reconnecting remains a
 * one-click, reversible action.
 */
export function disconnectRuntimeLocalFolder(): Promise<void> {
  const disconnect = localFolderActivationQueue.then(() => disconnectRuntimeLocalFolderNow());
  localFolderActivationQueue = disconnect.then(
    () => undefined,
    () => undefined
  );
  return disconnect;
}

async function disconnectRuntimeLocalFolderNow(): Promise<void> {
  if (runtimeLocalFolderIsDisconnected()) {
    if (loadActiveLocalFolder() && !saveActiveLocalFolder("")) {
      throw new Error("Could not clear the active local library in renderer storage.");
    }
    return;
  }

  const desktop = isTauri();
  const rendererFolder = loadActiveLocalFolder();
  const native = desktop ? await reconcileNativeLocalFolder() : null;
  const activeFolder = native?.folder ?? rendererFolder;
  let frozenFiles: string | null = null;
  let frozenState: string | null = null;

  try {
    if (desktop && activeFolder) {
      frozenFiles = await beginLocalFileWriteHandoff(activeFolder);
      frozenState = await beginLocalFolderSwitch(activeFolder);
    }

    setRuntimeLocalFolderDisconnected(true);
    if (!saveActiveLocalFolder("")) {
      throw new Error("Could not clear the active local library in renderer storage.");
    }
    // Keep the previous desktop root frozen while it is disconnected. A later
    // successful activation completes both handoffs and re-enables writes.
  } catch (error) {
    setRuntimeLocalFolderDisconnected(false);
    if (desktop) {
      cancelLocalFolderSwitch(frozenState);
      cancelLocalFileWriteHandoff(frozenFiles);
    }
    throw error;
  }
}

function runtimeLocalFolderIsDisconnected(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      window.localStorage?.getItem(RUNTIME_LOCAL_DISCONNECTED_KEY) === "1"
    );
  } catch {
    return false;
  }
}

function setRuntimeLocalFolderDisconnected(disconnected: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (disconnected) window.localStorage.setItem(RUNTIME_LOCAL_DISCONNECTED_KEY, "1");
    else window.localStorage.removeItem(RUNTIME_LOCAL_DISCONNECTED_KEY);
  } catch {
    throw new Error("Could not persist the local library connection state.");
  }
}

export async function listRuntimeLocalFolder(folder: string): Promise<RawFileEntry[]> {
  return isTauri() ? listLocalFolder(folder) : listBrowserLocalFolder(folder);
}

export async function readRuntimeLocalFile(id: string): Promise<string> {
  if (isTauri() && !isBrowserLocalFileId(id)) {
    const root = loadActiveLocalFolder();
    if (!root) throw new Error("No active local library is selected.");
    return readLocalFile(root, id);
  }
  return readBrowserLocalFile(id);
}
