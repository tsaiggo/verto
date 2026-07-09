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
import { loadActiveLocalFolder } from "./local-folder";
import { inspectFolder, isTauri, listLocalFolder, pickFolder, readLocalFile } from "./tauri";

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

export async function chooseRuntimeLocalFolder(): Promise<RuntimeLocalFolderSelection | null> {
  if (isTauri()) {
    const folder = await pickFolder();
    if (!folder) return null;
    return {
      folder,
      inspection: await inspectDesktopFolder(folder),
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

export async function listRuntimeLocalFolder(folder: string): Promise<RawFileEntry[]> {
  return isTauri() ? listLocalFolder(folder) : listBrowserLocalFolder(folder);
}

export async function readRuntimeLocalFile(id: string): Promise<string> {
  if (isTauri() && !isBrowserLocalFileId(id)) return readLocalFile(id);
  return readBrowserLocalFile(id);
}

async function inspectDesktopFolder(folder: string): Promise<FolderInspection | null> {
  try {
    return await inspectFolder(folder);
  } catch {
    return null;
  }
}
