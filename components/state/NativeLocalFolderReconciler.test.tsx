// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isTauri: vi.fn(),
  reconcileNativeLocalFolder: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/tauri", () => ({ isTauri: mocks.isTauri }));
vi.mock("@/lib/state-store", () => ({
  reconcileNativeLocalFolder: mocks.reconcileNativeLocalFolder,
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

import NativeLocalFolderReconciler from "./NativeLocalFolderReconciler";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

async function renderReconciler() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(NativeLocalFolderReconciler)));
  return root;
}

describe("NativeLocalFolderReconciler", () => {
  beforeEach(() => {
    mocks.isTauri.mockReset().mockReturnValue(true);
    mocks.reconcileNativeLocalFolder.mockReset().mockResolvedValue({
      folder: "C:/Library",
      available: true,
    });
    mocks.toastError.mockReset();
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("reconciles the renderer with the native registry at desktop startup", async () => {
    const root = await renderReconciler();

    await vi.waitFor(() => expect(mocks.reconcileNativeLocalFolder).toHaveBeenCalledOnce());
    await act(async () => root.unmount());
  });

  it("does nothing in a browser build", async () => {
    mocks.isTauri.mockReturnValue(false);
    const root = await renderReconciler();

    expect(mocks.reconcileNativeLocalFolder).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("surfaces native registry failures without an unhandled rejection", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.reconcileNativeLocalFolder.mockRejectedValue(new Error("registry unavailable"));
    const root = await renderReconciler();

    await vi.waitFor(() => expect(mocks.toastError).toHaveBeenCalledOnce());
    expect(consoleError).toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
