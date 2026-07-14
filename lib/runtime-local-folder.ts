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
  const folder = loadActiveLocalFolder();
  if (!folder) return null;
  if (isTauri()) return folder;
  return hasBrowserLocalFolder(folder) ? folder : null;
}

let localFolderActivationQueue: Promise<void> = Promise.resolve();

function persistActiveFolder(folder: string): void {
  if (!saveActiveLocalFolder(folder)) {
    throw new Error("Could not remember the active local library in renderer storage.");
  }
}

export async function chooseRuntimeLocalFolder(): Promise<RuntimeLocalFolderSelection | null> {
  if (isTauri()) {
    const folder = await pickFolder();
    if (!folder) return null;
    const inspection = await activateRuntimeLocalFolder(folder);
    return {
      folder: loadActiveLocalFolder() ?? folder,
      inspection,
      mode: "desktop",
    };
  }

  const selection = await pickBrowserLocalFolder();
  if (!selection) return null;
  persistActiveFolder(selection.folder);
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
