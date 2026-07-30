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
  readLocalFileVersioned,
  readVaultStateVersioned,
  writeLocalFile,
  writeVaultStateIfRevision,
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

  it("reads markdown with the revision required for a safe save", async () => {
    invokeMock.mockResolvedValue({ source: "# Runtime README", revision: "abc123" });

    await expect(
      readLocalFileVersioned("/Users/me/Notes", "/Users/me/Notes/README.md")
    ).resolves.toEqual({ source: "# Runtime README", revision: "abc123" });
    expect(invokeMock).toHaveBeenCalledWith("read_local_file_versioned", {
      root: "/Users/me/Notes",
      id: "/Users/me/Notes/README.md",
    });
  });

  it("writes markdown through the selected desktop library root", async () => {
    invokeMock.mockResolvedValue({ status: "saved", revision: "new-revision" });

    await expect(
      writeLocalFile("/Users/me/Notes", "/Users/me/Notes/drafts/new.md", "# New")
    ).resolves.toEqual({ revision: "new-revision" });
    expect(invokeMock).toHaveBeenCalledWith("write_local_file", {
      root: "/Users/me/Notes",
      id: "/Users/me/Notes/drafts/new.md",
      content: "# New",
      expectedRevision: null,
      force: false,
    });
  });

  it("turns a native revision mismatch into a structured conflict error", async () => {
    invokeMock.mockResolvedValue({
      status: "conflict",
      expectedRevision: "opened",
      actualRevision: "external",
    });

    await expect(
      writeLocalFile("/Users/me/Notes", "/Users/me/Notes/note.md", "# Local", {
        expectedRevision: "opened",
      })
    ).rejects.toMatchObject({
      name: "LocalFileWriteConflictError",
      code: "LOCAL_FILE_WRITE_CONFLICT",
      expectedRevision: "opened",
      actualRevision: "external",
    });
    expect(invokeMock).toHaveBeenCalledWith("write_local_file", {
      root: "/Users/me/Notes",
      id: "/Users/me/Notes/note.md",
      content: "# Local",
      expectedRevision: "opened",
      force: false,
    });
  });

  it("drains an in-flight Markdown save before freezing a library handoff", async () => {
    let finishWrite!: () => void;
    invokeMock.mockImplementationOnce(
      () =>
        new Promise<{ status: "saved"; revision: string }>((resolve) => {
          finishWrite = () => resolve({ status: "saved", revision: "draft-revision" });
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
    await expect(writing).resolves.toEqual({ revision: "draft-revision" });
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

  it("reads portable state with the revision required for a CAS mirror", async () => {
    invokeMock.mockResolvedValue({
      json: '["saved"]',
      revision: "disk-revision-1",
    });

    await expect(readVaultStateVersioned("/Users/me/Notes", "bookmarks")).resolves.toEqual({
      json: '["saved"]',
      revision: "disk-revision-1",
    });
    expect(invokeMock).toHaveBeenCalledWith("read_vault_state_versioned", {
      root: "/Users/me/Notes",
      name: "bookmarks",
    });
  });

  it("passes the recovery identity to native CAS writes", async () => {
    invokeMock.mockResolvedValue({ status: "saved", revision: "disk-revision-2" });

    await expect(
      writeVaultStateIfRevision("/Users/me/Notes", "bookmarks", '["next"]', {
        expectedRevision: "disk-revision-1",
        writerId: "renderer-device-a",
        recoveryToken: "recovery-1",
      })
    ).resolves.toEqual({ revision: "disk-revision-2" });
    expect(invokeMock).toHaveBeenCalledWith("write_vault_state_if_revision", {
      root: "/Users/me/Notes",
      name: "bookmarks",
      json: '["next"]',
      expectedRevision: "disk-revision-1",
      writerId: "renderer-device-a",
      recoveryToken: "recovery-1",
    });
  });

  it("surfaces portable-state conflicts without leaking the payload", async () => {
    invokeMock.mockResolvedValue({
      status: "conflict",
      expectedRevision: "disk-revision-1",
      actualRevision: "remote-revision",
      conflictPath: "/Users/me/Notes/.verto/conflicts/bookmarks.conflict.json",
      preservationError: null,
    });

    await expect(
      writeVaultStateIfRevision("/Users/me/Notes", "bookmarks", '["local-private-value"]', {
        expectedRevision: "disk-revision-1",
        writerId: "renderer-device-a",
        recoveryToken: "recovery-2",
      })
    ).rejects.toMatchObject({
      name: "VaultStateWriteConflictError",
      code: "PORTABLE_STATE_CONFLICT",
      expectedRevision: "disk-revision-1",
      actualRevision: "remote-revision",
      conflictPath: "/Users/me/Notes/.verto/conflicts/bookmarks.conflict.json",
    });
    await expect(
      writeVaultStateIfRevision("/Users/me/Notes", "bookmarks", '["local-private-value"]', {
        expectedRevision: "disk-revision-1",
        writerId: "renderer-device-a",
        recoveryToken: "recovery-2",
      })
    ).rejects.not.toThrow("local-private-value");
  });
});
