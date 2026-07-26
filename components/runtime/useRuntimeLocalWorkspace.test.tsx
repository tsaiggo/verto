// @vitest-environment jsdom

import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtimeFolderMocks = vi.hoisted(() => ({
  chooseRuntimeLocalFolder: vi.fn(),
  loadActiveRuntimeLocalFolder: vi.fn(),
  readRuntimeLocalFile: vi.fn(),
}));
const tauriMocks = vi.hoisted(() => ({
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

async function renderWorkspaceHook(file: string): Promise<{
  getCurrent: () => WorkspaceState;
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

  function Probe() {
    const workspace = useRuntimeLocalWorkspace({ file, router });
    useEffect(() => {
      current = workspace;
    }, [workspace]);
    return null;
  }

  await act(async () => root.render(createElement(Probe)));
  return {
    getCurrent: () => {
      if (!current) throw new Error("Expected the workspace hook to render");
      return current;
    },
    root,
  };
}

beforeEach(() => {
  runtimeFolderMocks.chooseRuntimeLocalFolder.mockReset();
  runtimeFolderMocks.loadActiveRuntimeLocalFolder.mockReset().mockReturnValue("C:\\Notes");
  runtimeFolderMocks.readRuntimeLocalFile.mockReset();
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
    runtimeFolderMocks.readRuntimeLocalFile
      .mockRejectedValueOnce(new Error("The file is temporarily unavailable."))
      .mockResolvedValueOnce("# Recovered\n");
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
      })
    );
    expect(runtimeFolderMocks.readRuntimeLocalFile).toHaveBeenCalledTimes(2);

    await act(async () => root.unmount());
  });
});
