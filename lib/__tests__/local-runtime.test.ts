import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

import {
  activateLocalLibrary,
  beginLocalFileWriteHandoff,
  cancelLocalFileWriteHandoff,
  getActiveLocalLibrary,
  listLocalFolder,
  pickFolder,
  readLocalFile,
  readVaultState,
  writeLocalFile,
  writeVaultState,
} from "@/lib/tauri";

describe("local folder runtime loader", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    vi.stubGlobal("window", { __TAURI_INTERNALS__: {} });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists markdown files through the desktop shell", async () => {
    invokeMock.mockResolvedValue([
      {
        path: ["docs", "intro.md"],
        id: "/Users/me/Notes/docs/intro.md",
        size: 42,
        mtime: 1_717_000_000_000,
      },
    ]);

    await expect(listLocalFolder("/Users/me/Notes")).resolves.toEqual([
      {
        path: ["docs", "intro.md"],
        id: "/Users/me/Notes/docs/intro.md",
        size: 42,
        mtime: 1_717_000_000_000,
      },
    ]);
    expect(invokeMock).toHaveBeenCalledWith("list_local_dir", {
      folder: "/Users/me/Notes",
    });
  });

  it("reads markdown file text through the desktop shell", async () => {
    invokeMock.mockResolvedValue("# Runtime README");

    await expect(readLocalFile("/Users/me/Notes", "/Users/me/Notes/README.md")).resolves.toBe(
      "# Runtime README"
    );
    expect(invokeMock).toHaveBeenCalledWith("read_local_file", {
      root: "/Users/me/Notes",
      id: "/Users/me/Notes/README.md",
    });
  });

  it("writes markdown through the selected desktop library root", async () => {
    invokeMock.mockResolvedValue(undefined);

    await expect(
      writeLocalFile("/Users/me/Notes", "/Users/me/Notes/drafts/new.md", "# New")
    ).resolves.toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith("write_local_file", {
      root: "/Users/me/Notes",
      id: "/Users/me/Notes/drafts/new.md",
      content: "# New",
    });
  });

  it("drains an in-flight Markdown save before freezing a library handoff", async () => {
    let finishWrite!: () => void;
    invokeMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishWrite = resolve;
        })
    );

    const writing = writeLocalFile("/Users/me/Notes", "/Users/me/Notes/draft.md", "# Draft");
    const handoff = beginLocalFileWriteHandoff("/Users/me/Notes");
    let drained = false;
    void handoff.then(() => {
      drained = true;
    });

    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledOnce());
    expect(drained).toBe(false);
    finishWrite();
    await expect(writing).resolves.toBeUndefined();
    await expect(handoff).resolves.toBe("/Users/me/Notes");
    await expect(
      writeLocalFile("/Users/me/Notes", "/Users/me/Notes/late.md", "# Late")
    ).rejects.toThrow("library is changing");

    cancelLocalFileWriteHandoff("/Users/me/Notes");
  });

  it("uses dedicated native commands for picker authorization and activation", async () => {
    invokeMock
      .mockResolvedValueOnce("/Users/me/Notes")
      .mockResolvedValueOnce({
        folder: "/Users/me/Notes",
        available: true,
        rendererMatchesActive: true,
      })
      .mockResolvedValueOnce({
        folder: "/Users/me/Notes",
        inspection: { exists: true, isDir: true, fileCount: 1, samples: ["intro.md"] },
      });

    await expect(pickFolder()).resolves.toBe("/Users/me/Notes");
    await expect(getActiveLocalLibrary()).resolves.toMatchObject({ folder: "/Users/me/Notes" });
    await expect(activateLocalLibrary("/Users/me/Notes")).resolves.toMatchObject({
      folder: "/Users/me/Notes",
      inspection: { fileCount: 1 },
    });

    expect(invokeMock).toHaveBeenNthCalledWith(1, "pick_local_library", undefined);
    expect(invokeMock).toHaveBeenNthCalledWith(2, "get_active_local_library", {
      rendererFolder: null,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "activate_local_library", {
      folder: "/Users/me/Notes",
    });
  });

  it("reads and writes portable state only through native vault commands", async () => {
    invokeMock.mockResolvedValueOnce('["saved"]').mockResolvedValueOnce(undefined);

    await expect(readVaultState("/Users/me/Notes", "bookmarks")).resolves.toBe('["saved"]');
    await expect(
      writeVaultState("/Users/me/Notes", "bookmarks", '["saved","new"]')
    ).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenNthCalledWith(1, "read_vault_state", {
      root: "/Users/me/Notes",
      name: "bookmarks",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "write_vault_state", {
      root: "/Users/me/Notes",
      name: "bookmarks",
      json: '["saved","new"]',
    });
  });
});
