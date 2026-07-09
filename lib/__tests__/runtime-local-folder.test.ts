import { beforeEach, describe, expect, it, vi } from "vitest";

const isTauriMock = vi.hoisted(() => vi.fn());
const pickFolderMock = vi.hoisted(() => vi.fn());
const inspectFolderMock = vi.hoisted(() => vi.fn());
const listLocalFolderMock = vi.hoisted(() => vi.fn());
const readLocalFileMock = vi.hoisted(() => vi.fn());
const canUseBrowserLocalPickerMock = vi.hoisted(() => vi.fn());
const hasBrowserLocalFolderMock = vi.hoisted(() => vi.fn());
const pickBrowserLocalFolderMock = vi.hoisted(() => vi.fn());
const listBrowserLocalFolderMock = vi.hoisted(() => vi.fn());
const readBrowserLocalFileMock = vi.hoisted(() => vi.fn());
const loadActiveLocalFolderMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tauri", () => ({
  isTauri: isTauriMock,
  pickFolder: pickFolderMock,
  inspectFolder: inspectFolderMock,
  listLocalFolder: listLocalFolderMock,
  readLocalFile: readLocalFileMock,
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
}));

import {
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
  });

  it("uses the browser picker mode outside Tauri", () => {
    expect(runtimeLocalPickerMode()).toBe("browser");
  });

  it("uses the desktop picker and native list/read calls in Tauri", async () => {
    isTauriMock.mockReturnValue(true);
    pickFolderMock.mockResolvedValue("C:/Notes");
    inspectFolderMock.mockResolvedValue(inspection);
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
    await expect(readRuntimeLocalFile("C:/Notes/intro.md")).resolves.toBe("# Intro");
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
  });

  it("ignores stale browser active folders when the cache is gone", () => {
    hasBrowserLocalFolderMock.mockReturnValue(false);

    expect(loadActiveRuntimeLocalFolder()).toBeNull();
  });
});
