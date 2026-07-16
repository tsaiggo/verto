// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtimeLocalPickerMode = vi.hoisted(() => vi.fn());
const chooseRuntimeLocalFolder = vi.hoisted(() => vi.fn());
const activateRuntimeLocalFolder = vi.hoisted(() => vi.fn());
const loadActiveRuntimeLocalFolder = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock("@/lib/runtime-local-folder", () => ({
  activateRuntimeLocalFolder,
  chooseRuntimeLocalFolder,
  loadActiveRuntimeLocalFolder,
  runtimeLocalPickerMode,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: toastSuccess,
    warning: vi.fn(),
  }),
}));

import LocalFolderPickerButton from "./LocalFolderPickerButton";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

async function renderPicker() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(LocalFolderPickerButton));
    await Promise.resolve();
  });
  return { host, root };
}

describe("LocalFolderPickerButton", () => {
  beforeEach(() => {
    runtimeLocalPickerMode.mockReset();
    chooseRuntimeLocalFolder.mockReset();
    activateRuntimeLocalFolder.mockReset();
    loadActiveRuntimeLocalFolder.mockReset();
    toastSuccess.mockReset();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("hides the header shortcut when folder selection is unavailable", async () => {
    runtimeLocalPickerMode.mockReturnValue("unavailable");
    const { host, root } = await renderPicker();

    expect(host.querySelector("button")).toBeNull();

    act(() => root.unmount());
  });

  it("keeps the shortcut enabled when the runtime supports choosing a folder", async () => {
    runtimeLocalPickerMode.mockReturnValue("browser");
    const { host, root } = await renderPicker();
    const button = host.querySelector("button");

    expect(button).not.toBeNull();
    expect(button?.textContent).toContain("Choose folder");
    expect(button?.hasAttribute("disabled")).toBe(false);

    act(() => root.unmount());
  });

  it("connects an explicitly chosen folder before reporting success", async () => {
    runtimeLocalPickerMode.mockReturnValue("desktop");
    chooseRuntimeLocalFolder.mockResolvedValue({
      folder: "C:/Notes",
      inspection: null,
      mode: "desktop",
    });
    activateRuntimeLocalFolder.mockResolvedValue({
      exists: true,
      isDir: true,
      fileCount: 1,
      samples: ["intro.md"],
    });
    loadActiveRuntimeLocalFolder.mockReturnValue("C:\\Notes");
    const { host, root } = await renderPicker();

    await act(async () => {
      host.querySelector<HTMLButtonElement>("button")?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(chooseRuntimeLocalFolder).toHaveBeenCalledOnce();
    expect(activateRuntimeLocalFolder).toHaveBeenCalledWith("C:/Notes");
    expect(toastSuccess).toHaveBeenCalledWith(
      "Local library connected",
      expect.objectContaining({ description: expect.stringContaining("refresh") })
    );

    act(() => root.unmount());
  });
});
