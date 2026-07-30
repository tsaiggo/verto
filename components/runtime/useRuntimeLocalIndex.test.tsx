// @vitest-environment jsdom

import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const indexMocks = vi.hoisted(() => ({
  applyRuntimeLocalIndexBatch: vi.fn(),
  buildRuntimeLocalIndex: vi.fn(),
}));
const folderMocks = vi.hoisted(() => ({
  loadActiveRuntimeLocalFolder: vi.fn(),
}));
const tauriMocks = vi.hoisted(() => ({
  isTauri: vi.fn(),
  isVaultWatchBatch: vi.fn(),
}));

vi.mock("@/lib/runtime-local-index", () => indexMocks);
vi.mock("@/lib/runtime-local-folder", () => folderMocks);
vi.mock("@/lib/tauri", () => tauriMocks);

import type { RuntimeLocalIndex } from "@/lib/runtime-local-index";
import { RUNTIME_VAULT_RESCAN_EVENT, RUNTIME_VAULT_WATCH_EVENT } from "@/lib/vault-watch";
import { useRuntimeLocalIndex, type RuntimeLocalIndexState } from "./useRuntimeLocalIndex";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

function emptyIndex(folder: string): RuntimeLocalIndex {
  return {
    folder,
    cacheDocuments: [],
    documents: [],
    libraryDocs: [],
    searchRecords: [],
    counts: { all: 0, page: 0, heading: 0, code: 0, folder: 0 },
    tags: [],
    tagCounts: [],
  };
}

async function renderHook(): Promise<{
  current: () => RuntimeLocalIndexState;
  root: Root;
}> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let state: RuntimeLocalIndexState | null = null;

  function Probe() {
    const value = useRuntimeLocalIndex();
    useEffect(() => {
      state = value;
    }, [value]);
    return null;
  }

  await act(async () => root.render(createElement(Probe)));
  return {
    current: () => {
      if (!state) throw new Error("Expected local index state");
      return state;
    },
    root,
  };
}

beforeEach(() => {
  folderMocks.loadActiveRuntimeLocalFolder.mockReset().mockReturnValue("C:/Vault");
  tauriMocks.isTauri.mockReset().mockReturnValue(true);
  tauriMocks.isVaultWatchBatch.mockReset().mockReturnValue(false);
  indexMocks.applyRuntimeLocalIndexBatch.mockReset();
  indexMocks.buildRuntimeLocalIndex.mockReset();
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("useRuntimeLocalIndex", () => {
  it("coalesces a rescan burst into one in-flight scan and one follow-up", async () => {
    const first = deferred<RuntimeLocalIndex>();
    const second = deferred<RuntimeLocalIndex>();
    indexMocks.buildRuntimeLocalIndex
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const { current, root } = await renderHook();

    await vi.waitFor(() => expect(indexMocks.buildRuntimeLocalIndex).toHaveBeenCalledOnce());
    await act(async () => {
      for (let index = 0; index < 6; index += 1) {
        window.dispatchEvent(
          new CustomEvent(RUNTIME_VAULT_RESCAN_EVENT, {
            detail: { root: "C:/Vault", reason: "fallback-poll" },
          })
        );
      }
    });
    expect(indexMocks.buildRuntimeLocalIndex).toHaveBeenCalledOnce();

    await act(async () => first.resolve(emptyIndex("C:/Vault")));
    await vi.waitFor(() => expect(indexMocks.buildRuntimeLocalIndex).toHaveBeenCalledTimes(2));
    expect(indexMocks.buildRuntimeLocalIndex).toHaveBeenLastCalledWith(
      "C:/Vault",
      expect.objectContaining({ folder: "C:/Vault" })
    );

    await act(async () => second.resolve(emptyIndex("C:/Vault")));
    await vi.waitFor(() => expect(current().status).toBe("ready"));
    expect(indexMocks.buildRuntimeLocalIndex).toHaveBeenCalledTimes(2);

    await act(async () => root.unmount());
  });

  it("advances past a portable-state-only batch without rebuilding content", async () => {
    indexMocks.buildRuntimeLocalIndex.mockResolvedValue(emptyIndex("C:/Vault"));
    const { current, root } = await renderHook();
    await vi.waitFor(() => expect(current().status).toBe("ready"));
    expect(indexMocks.buildRuntimeLocalIndex).toHaveBeenCalledOnce();
    tauriMocks.isVaultWatchBatch.mockReturnValue(true);

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(RUNTIME_VAULT_WATCH_EVENT, {
          detail: {
            schemaVersion: 1,
            root: "C:/Vault",
            generation: 3,
            sequence: 1,
            rescan: false,
            changes: [],
            portableStateRescan: false,
            portableStateNames: ["bookmarks"],
          },
        })
      );
    });

    expect(indexMocks.buildRuntimeLocalIndex).toHaveBeenCalledOnce();
    expect(indexMocks.applyRuntimeLocalIndexBatch).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });
});
