// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import {
  RUNTIME_VAULT_RESCAN_EVENT,
  RUNTIME_VAULT_WATCH_STATUS_EVENT,
  type RuntimeVaultRescanDetail,
  type RuntimeVaultWatchStatus,
} from "@/lib/vault-watch";
import type { VaultWatchBatch, VaultWatchStatus } from "@/lib/tauri";

const mocks = vi.hoisted(() => ({
  isTauri: vi.fn(),
  listenVaultWatch: vi.fn(),
  listenVaultWatchStatus: vi.fn(),
  startVaultWatch: vi.fn(),
  stopVaultWatch: vi.fn(),
  loadActiveRuntimeLocalFolder: vi.fn(),
  unlistenBatches: vi.fn(),
  unlistenStatus: vi.fn(),
  batchListener: null as ((batch: VaultWatchBatch) => void) | null,
  statusListener: null as ((status: VaultWatchStatus) => void) | null,
  refreshLocalFolderState: vi.fn(),
}));

vi.mock("@/lib/tauri", () => ({
  isTauri: mocks.isTauri,
  isVaultWatchBatch: (value: unknown) => {
    if (typeof value !== "object" || value === null) return false;
    const batch = value as Partial<VaultWatchBatch>;
    return (
      batch.schemaVersion === 1 &&
      typeof batch.root === "string" &&
      typeof batch.generation === "number" &&
      typeof batch.sequence === "number" &&
      typeof batch.rescan === "boolean" &&
      Array.isArray(batch.changes) &&
      typeof batch.portableStateRescan === "boolean" &&
      Array.isArray(batch.portableStateNames) &&
      batch.portableStateNames.every((name) => typeof name === "string")
    );
  },
  isVaultWatchStatus: (value: unknown) => {
    if (typeof value !== "object" || value === null) return false;
    const status = value as Partial<VaultWatchStatus>;
    return (
      status.schemaVersion === 1 &&
      typeof status.root === "string" &&
      typeof status.generation === "number" &&
      (status.status === "available" ||
        (status.status === "degraded" && typeof status.error === "string"))
    );
  },
  listenVaultWatch: mocks.listenVaultWatch,
  listenVaultWatchStatus: mocks.listenVaultWatchStatus,
  startVaultWatch: mocks.startVaultWatch,
  stopVaultWatch: mocks.stopVaultWatch,
}));
vi.mock("@/lib/runtime-local-folder", () => ({
  loadActiveRuntimeLocalFolder: mocks.loadActiveRuntimeLocalFolder,
}));
vi.mock("@/lib/state-store", () => ({
  refreshLocalFolderState: mocks.refreshLocalFolderState,
}));

import VaultWatchBridge from "./VaultWatchBridge";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

async function renderBridge() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(VaultWatchBridge)));
  return root;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe("VaultWatchBridge", () => {
  beforeEach(() => {
    mocks.isTauri.mockReset().mockReturnValue(true);
    mocks.loadActiveRuntimeLocalFolder.mockReset().mockReturnValue("C:/Vault");
    mocks.unlistenBatches.mockReset();
    mocks.unlistenStatus.mockReset();
    mocks.batchListener = null;
    mocks.statusListener = null;
    mocks.listenVaultWatch
      .mockReset()
      .mockImplementation(async (listener: (batch: VaultWatchBatch) => void) => {
        mocks.batchListener = listener;
        return mocks.unlistenBatches;
      });
    mocks.listenVaultWatchStatus
      .mockReset()
      .mockImplementation(async (listener: (status: VaultWatchStatus) => void) => {
        mocks.statusListener = listener;
        return mocks.unlistenStatus;
      });
    mocks.startVaultWatch.mockReset().mockResolvedValue({
      schemaVersion: 1,
      root: "C:/Vault",
      generation: 9,
      sequence: 0,
    });
    mocks.stopVaultWatch.mockReset().mockResolvedValue(undefined);
    mocks.refreshLocalFolderState.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("calls the resolved Tauri unlisten handle and stops its generation", async () => {
    const root = await renderBridge();
    await vi.waitFor(() => expect(mocks.startVaultWatch).toHaveBeenCalledWith("C:/Vault"));

    await act(async () => root.unmount());

    expect(mocks.unlistenBatches).toHaveBeenCalledOnce();
    expect(mocks.unlistenStatus).toHaveBeenCalledOnce();
    expect(mocks.stopVaultWatch).toHaveBeenCalledWith(9);
  });

  it("publishes a forced rescan boundary after native watch startup", async () => {
    const rescans: RuntimeVaultRescanDetail[] = [];
    const onRescan = (event: Event) => {
      rescans.push((event as CustomEvent<RuntimeVaultRescanDetail>).detail);
    };
    window.addEventListener(RUNTIME_VAULT_RESCAN_EVENT, onRescan);
    const root = await renderBridge();

    await vi.waitFor(() =>
      expect(rescans).toContainEqual({
        root: "C:/Vault",
        reason: "watch-started",
      })
    );

    window.removeEventListener(RUNTIME_VAULT_RESCAN_EVENT, onRescan);
    await act(async () => root.unmount());
  });

  it("authoritatively refreshes portable state after native watch startup", async () => {
    const root = await renderBridge();

    await vi.waitFor(() => expect(mocks.refreshLocalFolderState).toHaveBeenCalledWith("C:/Vault"));

    await act(async () => root.unmount());
  });

  it("unlistens immediately when native startup fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const rescans: RuntimeVaultRescanDetail[] = [];
    const statuses: RuntimeVaultWatchStatus[] = [];
    const onRescan = (event: Event) => {
      rescans.push((event as CustomEvent<RuntimeVaultRescanDetail>).detail);
    };
    const onStatus = (event: Event) => {
      statuses.push((event as CustomEvent<RuntimeVaultWatchStatus>).detail);
    };
    window.addEventListener(RUNTIME_VAULT_RESCAN_EVENT, onRescan);
    window.addEventListener(RUNTIME_VAULT_WATCH_STATUS_EVENT, onStatus);
    mocks.startVaultWatch.mockRejectedValue(new Error("watch backend unavailable"));
    const root = await renderBridge();

    await vi.waitFor(() => expect(mocks.unlistenBatches).toHaveBeenCalledOnce());
    expect(mocks.unlistenStatus).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalled();
    expect(statuses).toContainEqual({
      root: "C:/Vault",
      status: "degraded",
      error: "watch backend unavailable",
    });
    expect(rescans).toContainEqual({
      root: "C:/Vault",
      reason: "watch-unavailable",
    });
    await vi.waitFor(() => expect(mocks.refreshLocalFolderState).toHaveBeenCalledWith("C:/Vault"));

    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(rescans).toContainEqual({
      root: "C:/Vault",
      reason: "fallback-wake",
    });
    await vi.waitFor(() => expect(mocks.refreshLocalFolderState).toHaveBeenCalledTimes(2));

    await act(async () => root.unmount());
    expect(mocks.stopVaultWatch).not.toHaveBeenCalled();
    window.removeEventListener(RUNTIME_VAULT_RESCAN_EVENT, onRescan);
    window.removeEventListener(RUNTIME_VAULT_WATCH_STATUS_EVENT, onStatus);
  });

  it("enters fallback for runtime degradation and leaves it after native recovery", async () => {
    const rescans: RuntimeVaultRescanDetail[] = [];
    const statuses: RuntimeVaultWatchStatus[] = [];
    const onRescan = (event: Event) => {
      rescans.push((event as CustomEvent<RuntimeVaultRescanDetail>).detail);
    };
    const onStatus = (event: Event) => {
      statuses.push((event as CustomEvent<RuntimeVaultWatchStatus>).detail);
    };
    window.addEventListener(RUNTIME_VAULT_RESCAN_EVENT, onRescan);
    window.addEventListener(RUNTIME_VAULT_WATCH_STATUS_EVENT, onStatus);
    const root = await renderBridge();
    await vi.waitFor(() => expect(mocks.statusListener).not.toBeNull());

    await act(async () => {
      mocks.statusListener?.({
        schemaVersion: 1,
        root: "C:/Vault",
        generation: 9,
        status: "degraded",
        error: "Vault root was replaced",
      });
    });

    expect(statuses).toContainEqual({
      root: "C:/Vault",
      status: "degraded",
      error: "Vault root was replaced",
    });
    expect(rescans).toContainEqual({
      root: "C:/Vault",
      reason: "watch-unavailable",
    });
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(rescans).toContainEqual({
      root: "C:/Vault",
      reason: "fallback-wake",
    });

    await act(async () => {
      mocks.statusListener?.({
        schemaVersion: 1,
        root: "C:/Vault",
        generation: 9,
        status: "available",
      });
    });

    expect(statuses.at(-1)).toEqual({ root: "C:/Vault", status: "active" });
    const rescanCount = rescans.length;
    await act(async () => window.dispatchEvent(new Event("focus")));
    expect(rescans).toHaveLength(rescanCount);

    window.removeEventListener(RUNTIME_VAULT_RESCAN_EVENT, onRescan);
    window.removeEventListener(RUNTIME_VAULT_WATCH_STATUS_EVENT, onStatus);
    await act(async () => root.unmount());
  });

  it("coalesces startup and fallback portable-state refreshes into one follow-up", async () => {
    const first = deferred<void>();
    mocks.refreshLocalFolderState
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined);
    const root = await renderBridge();
    await vi.waitFor(() => expect(mocks.refreshLocalFolderState).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(mocks.statusListener).not.toBeNull());

    await act(async () => {
      mocks.statusListener?.({
        schemaVersion: 1,
        root: "C:/Vault",
        generation: 9,
        status: "degraded",
        error: "temporarily unavailable",
      });
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
    });
    expect(mocks.refreshLocalFolderState).toHaveBeenCalledOnce();

    await act(async () => first.resolve());
    await vi.waitFor(() => expect(mocks.refreshLocalFolderState).toHaveBeenCalledTimes(2));

    await act(async () => root.unmount());
  });

  it("refreshes only portable state names carried by a consecutive batch", async () => {
    const root = await renderBridge();
    await vi.waitFor(() => expect(mocks.batchListener).not.toBeNull());
    await vi.waitFor(() => expect(mocks.refreshLocalFolderState).toHaveBeenCalledWith("C:/Vault"));
    mocks.refreshLocalFolderState.mockClear();

    await act(async () => {
      mocks.batchListener?.({
        schemaVersion: 1,
        root: "C:/Vault",
        generation: 9,
        sequence: 1,
        rescan: false,
        changes: [],
        portableStateRescan: false,
        portableStateNames: ["bookmarks", "reading-state"],
      });
    });

    await vi.waitFor(() =>
      expect(mocks.refreshLocalFolderState).toHaveBeenCalledWith("C:/Vault", [
        "bookmarks",
        "reading-state",
      ])
    );

    await act(async () => root.unmount());
  });

  it("refreshes every known portable state after a sequence gap", async () => {
    const root = await renderBridge();
    await vi.waitFor(() => expect(mocks.batchListener).not.toBeNull());
    await vi.waitFor(() => expect(mocks.refreshLocalFolderState).toHaveBeenCalledWith("C:/Vault"));
    mocks.refreshLocalFolderState.mockClear();

    await act(async () => {
      mocks.batchListener?.({
        schemaVersion: 1,
        root: "C:/Vault",
        generation: 9,
        sequence: 3,
        rescan: false,
        changes: [],
        portableStateRescan: false,
        portableStateNames: ["bookmarks"],
      });
    });

    await vi.waitFor(() => expect(mocks.refreshLocalFolderState).toHaveBeenCalledWith("C:/Vault"));

    await act(async () => root.unmount());
  });

  it("does not refresh portable state for a stale root or generation", async () => {
    const root = await renderBridge();
    await vi.waitFor(() => expect(mocks.batchListener).not.toBeNull());
    await vi.waitFor(() => expect(mocks.refreshLocalFolderState).toHaveBeenCalledWith("C:/Vault"));
    mocks.refreshLocalFolderState.mockClear();

    await act(async () => {
      mocks.batchListener?.({
        schemaVersion: 1,
        root: "D:/Other",
        generation: 9,
        sequence: 1,
        rescan: false,
        changes: [],
        portableStateRescan: true,
        portableStateNames: [],
      });
      mocks.batchListener?.({
        schemaVersion: 1,
        root: "C:/Vault",
        generation: 8,
        sequence: 1,
        rescan: false,
        changes: [],
        portableStateRescan: true,
        portableStateNames: [],
      });
    });

    expect(mocks.refreshLocalFolderState).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });

  it("does not invalidate content context for a portable-state-only batch", async () => {
    const folderChanges = vi.fn();
    window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, folderChanges);
    const root = await renderBridge();
    await vi.waitFor(() => expect(mocks.batchListener).not.toBeNull());
    await vi.waitFor(() => expect(mocks.refreshLocalFolderState).toHaveBeenCalledWith("C:/Vault"));

    await act(async () => {
      mocks.batchListener?.({
        schemaVersion: 1,
        root: "C:/Vault",
        generation: 9,
        sequence: 1,
        rescan: false,
        changes: [],
        portableStateRescan: false,
        portableStateNames: ["bookmarks"],
      });
    });

    expect(folderChanges).not.toHaveBeenCalled();

    window.removeEventListener(LOCAL_FOLDER_CHANGED_EVENT, folderChanges);
    await act(async () => root.unmount());
  });

  it("ignores watcher callbacks after unmount", async () => {
    const root = await renderBridge();
    await vi.waitFor(() => expect(mocks.batchListener).not.toBeNull());
    await vi.waitFor(() => expect(mocks.refreshLocalFolderState).toHaveBeenCalledWith("C:/Vault"));
    mocks.refreshLocalFolderState.mockClear();
    const staleListener = mocks.batchListener;
    await act(async () => root.unmount());

    await act(async () => {
      staleListener?.({
        schemaVersion: 1,
        root: "C:/Vault",
        generation: 9,
        sequence: 1,
        rescan: false,
        changes: [],
        portableStateRescan: true,
        portableStateNames: [],
      });
    });

    expect(mocks.refreshLocalFolderState).not.toHaveBeenCalled();
  });

  it("does not subscribe in a browser build", async () => {
    mocks.isTauri.mockReturnValue(false);
    const root = await renderBridge();

    expect(mocks.listenVaultWatch).not.toHaveBeenCalled();
    expect(mocks.listenVaultWatchStatus).not.toHaveBeenCalled();
    expect(mocks.startVaultWatch).not.toHaveBeenCalled();

    await act(async () => root.unmount());
  });
});
