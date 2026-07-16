// @vitest-environment jsdom

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
  disconnectRuntimeLocalFolder,
  listRuntimeLocalFolder,
  loadActiveRuntimeLocalFolder,
  readRuntimeLocalFile,
  RUNTIME_LOCAL_DISCONNECTED_KEY,
  runtimeLocalPickerMode,
} from "@/lib/runtime-local-folder";

const inspection = { exists: true, isDir: true, fileCount: 1, samples: ["intro.md"] };
const entry = { id: "browser-local:Browser%20folder/intro.md", path: ["intro.md"] };

describe("runtime local folder facade", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        get length() {
          return values.size;
        },
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      } satisfies Storage,
    });
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
      inspection: null,
      mode: "desktop",
    });
    expect(activateLocalLibraryMock).not.toHaveBeenCalled();

    await expect(activateRuntimeLocalFolder("C:/Notes")).resolves.toEqual(inspection);
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
    expect(saveActiveLocalFolderMock).not.toHaveBeenCalled();

    await expect(activateRuntimeLocalFolder("Browser folder")).resolves.toEqual(inspection);
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
    expect(activateLocalLibraryMock).not.toHaveBeenCalled();

    await expect(activateRuntimeLocalFolder("C:/Legacy")).resolves.toEqual(inspection);

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

    await expect(chooseRuntimeLocalFolder()).resolves.toMatchObject({ folder: "C:/Broken" });
    await expect(activateRuntimeLocalFolder("C:/Broken")).rejects.toThrow("not authorized");

    expect(cancelLocalFolderSwitchMock).toHaveBeenCalledWith("Old folder");
    expect(cancelLocalFileWriteHandoffMock).toHaveBeenCalledWith("Old folder");
    expect(saveActiveLocalFolderMock).not.toHaveBeenCalled();
    expect(completeLocalFolderSwitchMock).not.toHaveBeenCalled();
  });

  it("unfreezes the actual native root when a post-activation step fails", async () => {
    isTauriMock.mockReturnValue(true);
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
    isTauriMock.mockReturnValue(true);
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

    await expect(chooseRuntimeLocalFolder()).resolves.toMatchObject({ folder: "C:/Notes" });
    await expect(activateRuntimeLocalFolder("C:/Notes")).resolves.toEqual(inspection);
    expect(saveActiveLocalFolderMock).toHaveBeenCalledWith("C:\\Notes");
    expect(completeLocalFolderSwitchMock).toHaveBeenCalledWith("C:\\Notes");
  });

  it("can replace a missing clean native library", async () => {
    isTauriMock.mockReturnValue(true);
    pickFolderMock.mockResolvedValue("C:/New");
    loadActiveLocalFolderMock.mockReturnValue("C:/New");
    reconcileNativeLocalFolderMock.mockResolvedValue({ folder: "C:/Missing", available: false });

    await expect(chooseRuntimeLocalFolder()).resolves.toMatchObject({ folder: "C:/New" });
    await expect(activateRuntimeLocalFolder("C:/New")).resolves.toEqual(inspection);
    expect(beginLocalFileWriteHandoffMock).toHaveBeenCalledWith("C:/Missing");
    expect(beginLocalFolderSwitchMock).toHaveBeenCalledWith("C:/New");
    expect(beginLocalFolderSwitchMock).not.toHaveBeenCalledWith("C:/Missing");
  });

  it("blocks replacing a missing library with pending recovery", async () => {
    isTauriMock.mockReturnValue(true);
    pickFolderMock.mockResolvedValue("C:/New");
    reconcileNativeLocalFolderMock.mockResolvedValue({ folder: "C:/Missing", available: false });
    hasPendingLocalFolderRecoveryMock.mockReturnValue(true);

    await expect(chooseRuntimeLocalFolder()).resolves.toMatchObject({ folder: "C:/New" });
    await expect(activateRuntimeLocalFolder("C:/New")).rejects.toThrow("pending portable state");
    expect(activateLocalLibraryMock).not.toHaveBeenCalled();
  });

  it("requires explicit activation after a browser selection", async () => {
    pickBrowserLocalFolderMock.mockResolvedValue({
      folder: "Browser folder",
      entries: [entry],
      inspection,
    });
    listBrowserLocalFolderMock.mockResolvedValue([entry]);

    await expect(chooseRuntimeLocalFolder()).resolves.toMatchObject({ folder: "Browser folder" });
    expect(saveActiveLocalFolderMock).not.toHaveBeenCalled();

    await expect(activateRuntimeLocalFolder("Browser folder")).resolves.toEqual(inspection);
    expect(saveActiveLocalFolderMock).toHaveBeenCalledWith("Browser folder");
  });

  it("rejects browser activation when the picker cache is unavailable", async () => {
    hasBrowserLocalFolderMock.mockReturnValue(false);

    await expect(activateRuntimeLocalFolder("Missing folder")).rejects.toThrow(
      "Choose this folder again"
    );
    expect(saveActiveLocalFolderMock).not.toHaveBeenCalled();
  });

  it("drains and freezes desktop writes before disconnecting the active library", async () => {
    isTauriMock.mockReturnValue(true);
    loadActiveLocalFolderMock.mockReturnValue("Old folder");

    await expect(disconnectRuntimeLocalFolder()).resolves.toBeUndefined();

    expect(beginLocalFileWriteHandoffMock).toHaveBeenCalledWith("Old folder");
    expect(beginLocalFolderSwitchMock).toHaveBeenCalledWith("Old folder");
    expect(saveActiveLocalFolderMock).toHaveBeenCalledWith("");
    expect(window.localStorage.getItem(RUNTIME_LOCAL_DISCONNECTED_KEY)).toBe("1");
    expect(completeLocalFolderSwitchMock).not.toHaveBeenCalled();
    expect(completeLocalFileWriteHandoffMock).not.toHaveBeenCalled();
  });

  it("keeps a native registry restore inactive after an explicit disconnect", () => {
    window.localStorage.setItem(RUNTIME_LOCAL_DISCONNECTED_KEY, "1");
    isTauriMock.mockReturnValue(true);
    loadActiveLocalFolderMock.mockReturnValue("Old folder");

    expect(loadActiveRuntimeLocalFolder()).toBeNull();
    expect(saveActiveLocalFolderMock).toHaveBeenCalledWith("");
  });

  it("reopens desktop writes when disconnect persistence fails", async () => {
    isTauriMock.mockReturnValue(true);
    loadActiveLocalFolderMock.mockReturnValue("Old folder");
    saveActiveLocalFolderMock.mockReturnValue(false);

    await expect(disconnectRuntimeLocalFolder()).rejects.toThrow(
      "Could not clear the active local library"
    );

    expect(cancelLocalFolderSwitchMock).toHaveBeenCalledWith("Old folder");
    expect(cancelLocalFileWriteHandoffMock).toHaveBeenCalledWith("Old folder");
  });
});
