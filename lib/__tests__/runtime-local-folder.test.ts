import { beforeEach, describe, expect, it, vi } from "vitest";

const isTauriMock = vi.hoisted(() => vi.fn());
const pickFolderMock = vi.hoisted(() => vi.fn());
const activateLocalLibraryMock = vi.hoisted(() => vi.fn());
const listLocalFolderMock = vi.hoisted(() => vi.fn());
const readLocalFileMock = vi.hoisted(() => vi.fn());
const beginLocalFileWriteHandoffMock = vi.hoisted(() => vi.fn());
const cancelLocalFileWriteHandoffMock = vi.hoisted(() => vi.fn());
const completeLocalFileWriteHandoffMock = vi.hoisted(() => vi.fn());
const canUseBrowserLocalPickerMock = vi.hoisted(() => vi.fn());
const hasBrowserLocalFolderMock = vi.hoisted(() => vi.fn());
const pickBrowserLocalFolderMock = vi.hoisted(() => vi.fn());
const listBrowserLocalFolderMock = vi.hoisted(() => vi.fn());
const readBrowserLocalFileMock = vi.hoisted(() => vi.fn());
const loadActiveLocalFolderMock = vi.hoisted(() => vi.fn());
const saveActiveLocalFolderMock = vi.hoisted(() => vi.fn());
const beginLocalFolderSwitchMock = vi.hoisted(() => vi.fn());
const cancelLocalFolderSwitchMock = vi.hoisted(() => vi.fn());
const completeLocalFolderSwitchMock = vi.hoisted(() => vi.fn());
const reconcileNativeLocalFolderMock = vi.hoisted(() => vi.fn());
const hasPendingLocalFolderRecoveryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tauri", () => ({
  isTauri: isTauriMock,
  pickFolder: pickFolderMock,
  activateLocalLibrary: activateLocalLibraryMock,
  listLocalFolder: listLocalFolderMock,
  readLocalFile: readLocalFileMock,
  beginLocalFileWriteHandoff: beginLocalFileWriteHandoffMock,
  cancelLocalFileWriteHandoff: cancelLocalFileWriteHandoffMock,
  completeLocalFileWriteHandoff: completeLocalFileWriteHandoffMock,
}));

vi.mock("@/lib/browser-local-folder", () => ({
  canUseBrowserLocalPicker: canUseBrowserLocalPickerMock,
  hasBrowserLocalFolder: hasBrowserLocalFolderMock,
  isBrowserLocalFileId: (id: string) => id.startsWith("browser-local:"),
  pickBrowserLocalFolder: pickBrowserLocalFolderMock,
  listBrowserLocalFolder: listBrowserLocalFolderMock,
  readBrowserLocalFile: readBrowserLocalFileMock,
}));

vi.mock("@/lib/local-folder", () => ({
  loadActiveLocalFolder: loadActiveLocalFolderMock,
  saveActiveLocalFolder: saveActiveLocalFolderMock,
}));

vi.mock("@/lib/state-store", () => ({
  beginLocalFolderSwitch: beginLocalFolderSwitchMock,
  cancelLocalFolderSwitch: cancelLocalFolderSwitchMock,
  completeLocalFolderSwitch: completeLocalFolderSwitchMock,
  hasPendingLocalFolderRecovery: hasPendingLocalFolderRecoveryMock,
  reconcileNativeLocalFolder: reconcileNativeLocalFolderMock,
}));

import {
  activateRuntimeLocalFolder,
  chooseRuntimeLocalFolder,
  listRuntimeLocalFolder,
  loadActiveRuntimeLocalFolder,
  readRuntimeLocalFile,
  runtimeLocalPickerMode,
} from "@/lib/runtime-local-folder";

const inspection = { exists: true, isDir: true, fileCount: 1, samples: ["intro.md"] };
const entry = { id: "browser-local:Browser%20folder/intro.md", path: ["intro.md"] };

describe("runtime local folder facade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTauriMock.mockReturnValue(false);
    canUseBrowserLocalPickerMock.mockReturnValue(true);
    hasBrowserLocalFolderMock.mockReturnValue(true);
    loadActiveLocalFolderMock.mockReturnValue("Browser folder");
    saveActiveLocalFolderMock.mockReturnValue(true);
    beginLocalFolderSwitchMock.mockResolvedValue("Old folder");
    beginLocalFileWriteHandoffMock.mockImplementation(async (folder: string) => folder);
    reconcileNativeLocalFolderMock.mockResolvedValue({ folder: "Old folder", available: true });
    hasPendingLocalFolderRecoveryMock.mockReturnValue(false);
    activateLocalLibraryMock.mockImplementation(async (folder: string) => ({ folder, inspection }));
  });

  it("uses the browser picker mode outside Tauri", () => {
    expect(runtimeLocalPickerMode()).toBe("browser");
  });

  it("uses the desktop picker and native list/read calls in Tauri", async () => {
    isTauriMock.mockReturnValue(true);
    pickFolderMock.mockResolvedValue("C:/Notes");
    loadActiveLocalFolderMock.mockReturnValue("C:/Notes");
    listLocalFolderMock.mockResolvedValue([{ id: "C:/Notes/intro.md", path: ["intro.md"] }]);
    readLocalFileMock.mockResolvedValue("# Intro");

    await expect(chooseRuntimeLocalFolder()).resolves.toEqual({
      folder: "C:/Notes",
      inspection,
      mode: "desktop",
    });
    await expect(listRuntimeLocalFolder("C:/Notes")).resolves.toEqual([
      { id: "C:/Notes/intro.md", path: ["intro.md"] },
    ]);
    loadActiveLocalFolderMock.mockReturnValue("C:/Notes");
    await expect(readRuntimeLocalFile("C:/Notes/intro.md")).resolves.toBe("# Intro");
    expect(readLocalFileMock).toHaveBeenCalledWith("C:/Notes", "C:/Notes/intro.md");
    expect(reconcileNativeLocalFolderMock).toHaveBeenCalledOnce();
    expect(beginLocalFileWriteHandoffMock).toHaveBeenCalledWith("Old folder");
    expect(beginLocalFolderSwitchMock).toHaveBeenCalledWith("Old folder");
    expect(activateLocalLibraryMock).toHaveBeenCalledWith("C:/Notes");
    expect(saveActiveLocalFolderMock).toHaveBeenCalledWith("C:/Notes");
    expect(completeLocalFolderSwitchMock).toHaveBeenCalledWith("C:/Notes");
    expect(completeLocalFileWriteHandoffMock).toHaveBeenCalledWith("C:/Notes");
    expect(beginLocalFileWriteHandoffMock.mock.invocationCallOrder[0]).toBeLessThan(
      beginLocalFolderSwitchMock.mock.invocationCallOrder[0]
    );
    expect(beginLocalFolderSwitchMock.mock.invocationCallOrder[0]).toBeLessThan(
      activateLocalLibraryMock.mock.invocationCallOrder[0]
    );
  });

  it("uses the browser cache for active folders outside Tauri", async () => {
    pickBrowserLocalFolderMock.mockResolvedValue({
      folder: "Browser folder",
      entries: [entry],
      inspection,
    });
    listBrowserLocalFolderMock.mockResolvedValue([entry]);
    readBrowserLocalFileMock.mockResolvedValue("# Browser Intro");

    expect(loadActiveRuntimeLocalFolder()).toBe("Browser folder");
    await expect(chooseRuntimeLocalFolder()).resolves.toEqual({
      folder: "Browser folder",
      inspection,
      mode: "browser",
    });
    await expect(listRuntimeLocalFolder("Browser folder")).resolves.toEqual([entry]);
    await expect(readRuntimeLocalFile(entry.id)).resolves.toBe("# Browser Intro");
    expect(saveActiveLocalFolderMock).toHaveBeenCalledWith("Browser folder");
  });

  it("bootstraps an authorized picker result when the native registry has no active root", async () => {
    isTauriMock.mockReturnValue(true);
    pickFolderMock.mockResolvedValue("C:/Legacy");
    reconcileNativeLocalFolderMock.mockResolvedValue({ folder: null, available: false });
    loadActiveLocalFolderMock.mockReturnValue("C:/Legacy");

    await expect(chooseRuntimeLocalFolder()).resolves.toMatchObject({
      folder: "C:/Legacy",
      mode: "desktop",
    });

    expect(activateLocalLibraryMock).toHaveBeenCalledWith("C:/Legacy");
    expect(saveActiveLocalFolderMock).toHaveBeenCalledWith("C:/Legacy");
    expect(beginLocalFolderSwitchMock).toHaveBeenCalledWith("C:/Legacy");
    expect(beginLocalFileWriteHandoffMock).not.toHaveBeenCalled();
    expect(activateLocalLibraryMock.mock.invocationCallOrder[0]).toBeLessThan(
      saveActiveLocalFolderMock.mock.invocationCallOrder[0]
    );
    expect(saveActiveLocalFolderMock.mock.invocationCallOrder[0]).toBeLessThan(
      beginLocalFolderSwitchMock.mock.invocationCallOrder[0]
    );
  });

  it("does not issue a desktop read without an active library root", async () => {
    isTauriMock.mockReturnValue(true);
    loadActiveLocalFolderMock.mockReturnValue(null);

    await expect(readRuntimeLocalFile("C:/Notes/intro.md")).rejects.toThrow(
      "No active local library is selected."
    );
    expect(readLocalFileMock).not.toHaveBeenCalled();
  });

  it("ignores stale browser active folders when the cache is gone", () => {
    hasBrowserLocalFolderMock.mockReturnValue(false);

    expect(loadActiveRuntimeLocalFolder()).toBeNull();
  });

  it("unfreezes the previous store when native activation fails", async () => {
    isTauriMock.mockReturnValue(true);
    pickFolderMock.mockResolvedValue("C:/Broken");
    activateLocalLibraryMock.mockRejectedValue(new Error("not authorized"));

    await expect(chooseRuntimeLocalFolder()).rejects.toThrow("not authorized");

    expect(cancelLocalFolderSwitchMock).toHaveBeenCalledWith("Old folder");
    expect(cancelLocalFileWriteHandoffMock).toHaveBeenCalledWith("Old folder");
    expect(saveActiveLocalFolderMock).not.toHaveBeenCalled();
    expect(completeLocalFolderSwitchMock).not.toHaveBeenCalled();
  });

  it("unfreezes the actual native root when a post-activation step fails", async () => {
    activateLocalLibraryMock.mockResolvedValue({ folder: "C:/Target", inspection });
    saveActiveLocalFolderMock.mockReturnValueOnce(false);

    await expect(activateRuntimeLocalFolder("C:/Target")).rejects.toThrow(
      "Could not remember the active local library"
    );

    expect(completeLocalFolderSwitchMock).toHaveBeenCalledWith("C:/Target");
    expect(completeLocalFileWriteHandoffMock).toHaveBeenCalledWith("C:/Target");
    expect(cancelLocalFolderSwitchMock).not.toHaveBeenCalled();
    expect(cancelLocalFileWriteHandoffMock).not.toHaveBeenCalled();
  });

  it("serializes concurrent native activations across the complete handoff", async () => {
    let releaseFirstActivation: (() => void) | undefined;
    const firstActivationBlocked = new Promise<void>((resolve) => {
      releaseFirstActivation = resolve;
    });
    reconcileNativeLocalFolderMock
      .mockResolvedValueOnce({ folder: "C:/A", available: true })
      .mockResolvedValueOnce({ folder: "C:/B", available: true });
    activateLocalLibraryMock.mockImplementation(async (folder: string) => {
      if (folder === "C:/B") await firstActivationBlocked;
      return { folder, inspection };
    });

    const activateB = activateRuntimeLocalFolder("C:/B");
    const activateC = activateRuntimeLocalFolder("C:/C");

    await vi.waitFor(() => expect(activateLocalLibraryMock).toHaveBeenCalledWith("C:/B"));
    expect(reconcileNativeLocalFolderMock).toHaveBeenCalledOnce();
    expect(beginLocalFileWriteHandoffMock).toHaveBeenCalledTimes(1);
    expect(activateLocalLibraryMock).not.toHaveBeenCalledWith("C:/C");

    releaseFirstActivation?.();
    await expect(activateB).resolves.toEqual(inspection);
    await expect(activateC).resolves.toEqual(inspection);

    expect(reconcileNativeLocalFolderMock).toHaveBeenCalledTimes(2);
    expect(beginLocalFileWriteHandoffMock).toHaveBeenNthCalledWith(1, "C:/A");
    expect(beginLocalFileWriteHandoffMock).toHaveBeenNthCalledWith(2, "C:/B");
    expect(completeLocalFileWriteHandoffMock.mock.invocationCallOrder[0]).toBeLessThan(
      reconcileNativeLocalFolderMock.mock.invocationCallOrder[1]
    );
  });

  it("uses the canonical folder returned by native activation", async () => {
    isTauriMock.mockReturnValue(true);
    pickFolderMock.mockResolvedValue("C:/Notes");
    loadActiveLocalFolderMock.mockReturnValue("C:\\Notes");
    activateLocalLibraryMock.mockResolvedValue({ folder: "C:\\Notes", inspection });

    await expect(chooseRuntimeLocalFolder()).resolves.toMatchObject({ folder: "C:\\Notes" });
    expect(saveActiveLocalFolderMock).toHaveBeenCalledWith("C:\\Notes");
    expect(completeLocalFolderSwitchMock).toHaveBeenCalledWith("C:\\Notes");
  });

  it("can replace a missing clean native library", async () => {
    isTauriMock.mockReturnValue(true);
    pickFolderMock.mockResolvedValue("C:/New");
    loadActiveLocalFolderMock.mockReturnValue("C:/New");
    reconcileNativeLocalFolderMock.mockResolvedValue({ folder: "C:/Missing", available: false });

    await expect(chooseRuntimeLocalFolder()).resolves.toMatchObject({ folder: "C:/New" });
    expect(beginLocalFileWriteHandoffMock).toHaveBeenCalledWith("C:/Missing");
    expect(beginLocalFolderSwitchMock).toHaveBeenCalledWith("C:/New");
    expect(beginLocalFolderSwitchMock).not.toHaveBeenCalledWith("C:/Missing");
  });

  it("blocks replacing a missing library with pending recovery", async () => {
    isTauriMock.mockReturnValue(true);
    pickFolderMock.mockResolvedValue("C:/New");
    reconcileNativeLocalFolderMock.mockResolvedValue({ folder: "C:/Missing", available: false });
    hasPendingLocalFolderRecoveryMock.mockReturnValue(true);

    await expect(chooseRuntimeLocalFolder()).rejects.toThrow("pending portable state");
    expect(activateLocalLibraryMock).not.toHaveBeenCalled();
  });
});
