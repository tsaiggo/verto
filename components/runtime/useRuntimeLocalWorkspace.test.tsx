// @vitest-environment jsdom

import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";

const runtimeFolderMocks = vi.hoisted(() => ({
  chooseRuntimeLocalFolder: vi.fn(),
  loadActiveRuntimeLocalFolder: vi.fn(),
  readRuntimeLocalFileVersioned: vi.fn(),
}));
const tauriMocks = vi.hoisted(() => ({
  isLocalFileWriteConflict: vi.fn(
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "LOCAL_FILE_WRITE_CONFLICT"
  ),
  isTauri: vi.fn(),
  writeLocalFile: vi.fn(),
}));

vi.mock("@/lib/runtime-local-folder", () => runtimeFolderMocks);
vi.mock("@/lib/tauri", () => tauriMocks);

import { useRuntimeLocalWorkspace } from "./useRuntimeLocalWorkspace";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

type WorkspaceState = ReturnType<typeof useRuntimeLocalWorkspace>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

let activeFolder = "C:\\Notes";

async function renderWorkspaceHook(initialFile: string): Promise<{
  getCurrent: () => WorkspaceState;
  rerenderFile: (file: string) => Promise<void>;
  root: Root;
}> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let current: WorkspaceState | null = null;
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
  };

  function Probe({ file }: { file: string }) {
    const workspace = useRuntimeLocalWorkspace({ file, router });
    useEffect(() => {
      current = workspace;
    }, [workspace]);
    return null;
  }

  await act(async () => root.render(createElement(Probe, { file: initialFile })));
  return {
    getCurrent: () => {
      if (!current) throw new Error("Expected the workspace hook to render");
      return current;
    },
    rerenderFile: async (file: string) => {
      await act(async () => root.render(createElement(Probe, { file })));
    },
    root,
  };
}

beforeEach(() => {
  activeFolder = "C:\\Notes";
  runtimeFolderMocks.chooseRuntimeLocalFolder.mockReset();
  runtimeFolderMocks.loadActiveRuntimeLocalFolder
    .mockReset()
    .mockImplementation(() => activeFolder);
  runtimeFolderMocks.readRuntimeLocalFileVersioned.mockReset();
  tauriMocks.isTauri.mockReset().mockReturnValue(true);
  tauriMocks.writeLocalFile.mockReset();
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("useRuntimeLocalWorkspace", () => {
  it("surfaces a page creation failure and leaves creation ready to retry", async () => {
    tauriMocks.writeLocalFile.mockRejectedValue(new Error("The folder is read-only."));
    const { getCurrent, root } = await renderWorkspaceHook("");

    await vi.waitFor(() => expect(getCurrent().desktop).toBe(true));
    await act(async () => {
      await getCurrent().createPage();
    });

    expect(getCurrent().isCreatingPage).toBe(false);
    expect(getCurrent().folderError).toBe("Could not create a new page. The folder is read-only.");
    expect(tauriMocks.writeLocalFile).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
  });

  it("retries a failed document read without requiring navigation", async () => {
    runtimeFolderMocks.readRuntimeLocalFileVersioned
      .mockRejectedValueOnce(new Error("The file is temporarily unavailable."))
      .mockResolvedValueOnce({ source: "# Recovered\n", revision: "recovered-revision" });
    const { getCurrent, root } = await renderWorkspaceHook("guide.mdx");

    await vi.waitFor(() =>
      expect(getCurrent().state).toEqual({
        status: "error",
        file: "guide.mdx",
        message: "The file is temporarily unavailable.",
      })
    );

    await act(async () => getCurrent().retryDocument());

    await vi.waitFor(() =>
      expect(getCurrent().state).toEqual({
        status: "ready",
        file: "guide.mdx",
        source: "# Recovered\n",
        revision: "recovered-revision",
      })
    );
    expect(runtimeFolderMocks.readRuntimeLocalFileVersioned).toHaveBeenCalledTimes(2);

    await act(async () => root.unmount());
  });

  it("keeps an external edit intact until the user explicitly overwrites it", async () => {
    runtimeFolderMocks.readRuntimeLocalFileVersioned.mockResolvedValue({
      source: "# Opened\n",
      revision: "opened-revision",
    });
    const conflict = Object.assign(new Error("This file changed on disk."), {
      code: "LOCAL_FILE_WRITE_CONFLICT",
      expectedRevision: "opened-revision",
      actualRevision: "external-revision",
    });
    tauriMocks.writeLocalFile
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce({ revision: "forced-revision" });
    const { getCurrent, root } = await renderWorkspaceHook("guide.mdx");
    await vi.waitFor(() =>
      expect(getCurrent().state).toMatchObject({
        status: "ready",
        revision: "opened-revision",
      })
    );

    let saveError: unknown;
    await act(async () => {
      try {
        await getCurrent().saveDocument({ source: "# Local draft\n" });
      } catch (error: unknown) {
        saveError = error;
      }
    });
    expect(saveError).toBe(conflict);
    await vi.waitFor(() =>
      expect(getCurrent().state).toMatchObject({
        status: "ready",
        source: "# Opened\n",
        revision: "opened-revision",
        conflict: {
          expectedRevision: "opened-revision",
          actualRevision: "external-revision",
        },
      })
    );

    await act(async () => {
      await getCurrent().saveDocument({
        source: "# Local draft\n",
        forceOverwrite: true,
      });
    });

    expect(tauriMocks.writeLocalFile).toHaveBeenNthCalledWith(
      1,
      "C:\\Notes",
      "guide.mdx",
      "# Local draft\n",
      { expectedRevision: "opened-revision", force: false }
    );
    expect(tauriMocks.writeLocalFile).toHaveBeenNthCalledWith(
      2,
      "C:\\Notes",
      "guide.mdx",
      "# Local draft\n",
      { expectedRevision: "opened-revision", force: true }
    );
    expect(getCurrent().state).toEqual({
      status: "ready",
      file: "guide.mdx",
      source: "# Local draft\n",
      revision: "forced-revision",
    });

    await act(async () => root.unmount());
  });

  it("keeps the ready document mounted when a conflict reload fails", async () => {
    runtimeFolderMocks.readRuntimeLocalFileVersioned
      .mockResolvedValueOnce({ source: "# Opened\n", revision: "opened-revision" })
      .mockRejectedValueOnce(new Error("The disk read failed."));
    const conflict = Object.assign(new Error("This file changed on disk."), {
      code: "LOCAL_FILE_WRITE_CONFLICT",
      expectedRevision: "opened-revision",
      actualRevision: "external-revision",
    });
    tauriMocks.writeLocalFile.mockRejectedValue(conflict);
    const { getCurrent, root } = await renderWorkspaceHook("guide.mdx");
    await vi.waitFor(() =>
      expect(getCurrent().state).toMatchObject({
        status: "ready",
        source: "# Opened\n",
      })
    );
    await act(async () => {
      await expect(getCurrent().saveDocument({ source: "# Protected local draft\n" })).rejects.toBe(
        conflict
      );
    });

    await act(async () => {
      await expect(getCurrent().retryDocument()).rejects.toThrow("The disk read failed.");
    });

    expect(getCurrent().state).toEqual({
      status: "ready",
      file: "guide.mdx",
      source: "# Opened\n",
      revision: "opened-revision",
      conflict: {
        expectedRevision: "opened-revision",
        actualRevision: "external-revision",
      },
    });

    await act(async () => root.unmount());
  });

  it("returns the disk source and commits it only after a conflict reload succeeds", async () => {
    runtimeFolderMocks.readRuntimeLocalFileVersioned
      .mockResolvedValueOnce({ source: "# Opened\n", revision: "opened-revision" })
      .mockResolvedValueOnce({ source: "# External\n", revision: "external-revision" });
    const { getCurrent, root } = await renderWorkspaceHook("guide.mdx");
    await vi.waitFor(() =>
      expect(getCurrent().state).toMatchObject({
        status: "ready",
        source: "# Opened\n",
      })
    );

    let reloadedSource = "";
    await act(async () => {
      reloadedSource = await getCurrent().retryDocument();
    });

    expect(reloadedSource).toBe("# External\n");
    expect(getCurrent().state).toEqual({
      status: "ready",
      file: "guide.mdx",
      source: "# External\n",
      revision: "external-revision",
    });

    await act(async () => root.unmount());
  });

  it("discards a stale document read when the active Vault changes", async () => {
    const vaultARead = deferred<{ source: string; revision: string }>();
    const vaultBRead = deferred<{ source: string; revision: string }>();
    runtimeFolderMocks.readRuntimeLocalFileVersioned
      .mockImplementationOnce(() => vaultARead.promise)
      .mockImplementationOnce(() => vaultBRead.promise);
    const { getCurrent, root } = await renderWorkspaceHook("shared.mdx");
    await vi.waitFor(() =>
      expect(runtimeFolderMocks.readRuntimeLocalFileVersioned).toHaveBeenCalledTimes(1)
    );

    await act(async () => {
      activeFolder = "D:\\Other Notes";
      window.dispatchEvent(new CustomEvent(LOCAL_FOLDER_CHANGED_EVENT));
    });
    await vi.waitFor(() =>
      expect(runtimeFolderMocks.readRuntimeLocalFileVersioned).toHaveBeenCalledTimes(2)
    );

    await act(async () => {
      vaultBRead.resolve({ source: "# Vault B\n", revision: "vault-b-revision" });
    });
    await vi.waitFor(() =>
      expect(getCurrent().state).toEqual({
        status: "ready",
        file: "shared.mdx",
        source: "# Vault B\n",
        revision: "vault-b-revision",
      })
    );

    await act(async () => {
      vaultARead.resolve({ source: "# Vault A\n", revision: "vault-a-revision" });
    });
    expect(getCurrent().state).toEqual({
      status: "ready",
      file: "shared.mdx",
      source: "# Vault B\n",
      revision: "vault-b-revision",
    });

    await act(async () => root.unmount());
  });

  it("discards a stale retry when the selected file changes", async () => {
    const staleRetry = deferred<{ source: string; revision: string }>();
    runtimeFolderMocks.readRuntimeLocalFileVersioned
      .mockResolvedValueOnce({ source: "# File A\n", revision: "file-a-revision" })
      .mockImplementationOnce(() => staleRetry.promise)
      .mockResolvedValueOnce({ source: "# File B\n", revision: "file-b-revision" });
    const { getCurrent, rerenderFile, root } = await renderWorkspaceHook("file-a.mdx");
    await vi.waitFor(() =>
      expect(getCurrent().state).toMatchObject({
        status: "ready",
        file: "file-a.mdx",
      })
    );

    let retryResult!: Promise<string>;
    await act(async () => {
      retryResult = getCurrent().retryDocument();
      void retryResult.catch(() => undefined);
    });
    await rerenderFile("file-b.mdx");
    await vi.waitFor(() =>
      expect(getCurrent().state).toEqual({
        status: "ready",
        file: "file-b.mdx",
        source: "# File B\n",
        revision: "file-b-revision",
      })
    );

    await act(async () => {
      staleRetry.resolve({ source: "# Stale file A\n", revision: "stale-file-a-revision" });
    });
    await expect(retryResult).rejects.toThrow("local library or page changed");
    expect(getCurrent().state).toEqual({
      status: "ready",
      file: "file-b.mdx",
      source: "# File B\n",
      revision: "file-b-revision",
    });

    await act(async () => root.unmount());
  });

  it("never carries a relative file revision across Vaults", async () => {
    const vaultBRead = deferred<{ source: string; revision: string }>();
    runtimeFolderMocks.readRuntimeLocalFileVersioned
      .mockResolvedValueOnce({ source: "# Vault A\n", revision: "vault-a-revision" })
      .mockImplementationOnce(() => vaultBRead.promise);
    tauriMocks.writeLocalFile.mockResolvedValue({ revision: "vault-b-saved-revision" });
    const { getCurrent, root } = await renderWorkspaceHook("shared.mdx");
    await vi.waitFor(() =>
      expect(getCurrent().state).toMatchObject({
        status: "ready",
        revision: "vault-a-revision",
      })
    );

    let staleSave!: Promise<void>;
    await act(async () => {
      activeFolder = "D:\\Other Notes";
      window.dispatchEvent(new CustomEvent(LOCAL_FOLDER_CHANGED_EVENT));
      staleSave = getCurrent().saveDocument({ source: "# Must not reach Vault B\n" });
      void staleSave.catch(() => undefined);
    });

    await expect(staleSave).rejects.toThrow("local library or page changed");
    expect(tauriMocks.writeLocalFile).not.toHaveBeenCalled();

    await act(async () => {
      vaultBRead.resolve({ source: "# Vault B\n", revision: "vault-b-revision" });
    });
    await vi.waitFor(() =>
      expect(getCurrent().state).toMatchObject({
        status: "ready",
        source: "# Vault B\n",
        revision: "vault-b-revision",
      })
    );
    await act(async () => {
      await getCurrent().saveDocument({ source: "# Saved in Vault B\n" });
    });
    expect(tauriMocks.writeLocalFile).toHaveBeenCalledWith(
      "D:\\Other Notes",
      "shared.mdx",
      "# Saved in Vault B\n",
      { expectedRevision: "vault-b-revision", force: false }
    );

    await act(async () => root.unmount());
  });

  it("does not publish a stale save receipt after the active Vault changes", async () => {
    const vaultAWrite = deferred<{ revision: string }>();
    runtimeFolderMocks.readRuntimeLocalFileVersioned
      .mockResolvedValueOnce({ source: "# Vault A\n", revision: "vault-a-revision" })
      .mockResolvedValueOnce({ source: "# Vault B\n", revision: "vault-b-revision" });
    tauriMocks.writeLocalFile.mockImplementationOnce(() => vaultAWrite.promise);
    const { getCurrent, root } = await renderWorkspaceHook("shared.mdx");
    await vi.waitFor(() =>
      expect(getCurrent().state).toMatchObject({
        status: "ready",
        revision: "vault-a-revision",
      })
    );

    let staleSave!: Promise<void>;
    await act(async () => {
      staleSave = getCurrent().saveDocument({ source: "# Saved in Vault A\n" });
      void staleSave.catch(() => undefined);
    });
    await act(async () => {
      activeFolder = "D:\\Other Notes";
      window.dispatchEvent(new CustomEvent(LOCAL_FOLDER_CHANGED_EVENT));
    });
    await vi.waitFor(() =>
      expect(getCurrent().state).toEqual({
        status: "ready",
        file: "shared.mdx",
        source: "# Vault B\n",
        revision: "vault-b-revision",
      })
    );

    await act(async () => {
      vaultAWrite.resolve({ revision: "vault-a-saved-revision" });
    });
    await expect(staleSave).rejects.toThrow("local library or page changed");
    expect(getCurrent().state).toEqual({
      status: "ready",
      file: "shared.mdx",
      source: "# Vault B\n",
      revision: "vault-b-revision",
    });

    await act(async () => root.unmount());
  });
});
