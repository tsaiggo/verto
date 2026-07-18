// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtimeLocalPickerMode = vi.hoisted(() => vi.fn());
const chooseRuntimeLocalFolder = vi.hoisted(() => vi.fn());
const activateRuntimeLocalFolder = vi.hoisted(() => vi.fn());
const loadActiveRuntimeLocalFolder = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/runtime-local-folder", () => ({
  activateRuntimeLocalFolder,
  chooseRuntimeLocalFolder,
  loadActiveRuntimeLocalFolder,
  runtimeLocalPickerMode,
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: toastError,
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
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe("LocalFolderPickerButton", () => {
  beforeEach(() => {
    runtimeLocalPickerMode.mockReset();
    chooseRuntimeLocalFolder.mockReset();
    activateRuntimeLocalFolder.mockReset();
    loadActiveRuntimeLocalFolder.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
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
  it("blocks duplicate picks while activation is pending", async () => {
    const inspection = {
      exists: true,
      isDir: true,
      fileCount: 1,
      samples: ["intro.md"],
    };
    const activation = deferred<typeof inspection>();
    runtimeLocalPickerMode.mockReturnValue("desktop");
    chooseRuntimeLocalFolder.mockResolvedValue({
      folder: "C:/Notes",
      inspection: null,
      mode: "desktop",
    });
    activateRuntimeLocalFolder.mockReturnValue(activation.promise);
    loadActiveRuntimeLocalFolder.mockReturnValue(null);
    const { host, root } = await renderPicker();
    const button = host.querySelector<HTMLButtonElement>("button");

    await act(async () => {
      button?.click();
      button?.click();
      await Promise.resolve();
    });

    expect(chooseRuntimeLocalFolder).toHaveBeenCalledOnce();
    expect(activateRuntimeLocalFolder).toHaveBeenCalledOnce();
    expect(button?.disabled).toBe(true);
    expect(button?.getAttribute("aria-busy")).toBe("true");

    loadActiveRuntimeLocalFolder.mockReturnValue("C:/Notes");
    await act(async () => {
      activation.resolve(inspection);
      await activation.promise;
      await Promise.resolve();
    });

    expect(button?.disabled).toBe(false);
    expect(toastSuccess).toHaveBeenCalledOnce();

    act(() => root.unmount());
  });

  it("reports a true activation failure and allows retrying", async () => {
    const inspection = {
      exists: true,
      isDir: true,
      fileCount: 1,
      samples: ["intro.md"],
    };
    runtimeLocalPickerMode.mockReturnValue("desktop");
    chooseRuntimeLocalFolder.mockResolvedValue({
      folder: "C:/Notes",
      inspection: null,
      mode: "desktop",
    });
    activateRuntimeLocalFolder
      .mockRejectedValueOnce(new Error("Permission denied"))
      .mockResolvedValue(inspection);
    loadActiveRuntimeLocalFolder.mockReturnValueOnce(null).mockReturnValue("C:/Notes");
    const { host, root } = await renderPicker();
    const button = host.querySelector<HTMLButtonElement>("button");

    await act(async () => {
      button?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(toastError).toHaveBeenCalledWith(
      "Could not connect the local library",
      expect.objectContaining({ description: "Permission denied" })
    );
    expect(button?.disabled).toBe(false);

    await act(async () => {
      button?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(activateRuntimeLocalFolder).toHaveBeenCalledTimes(2);
    expect(toastSuccess).toHaveBeenCalledOnce();

    act(() => root.unmount());
  });

  it("uses the authoritative active folder when activation committed before rejecting", async () => {
    runtimeLocalPickerMode.mockReturnValue("desktop");
    chooseRuntimeLocalFolder.mockResolvedValue({
      folder: "C:/Notes/",
      inspection: null,
      mode: "desktop",
    });
    activateRuntimeLocalFolder.mockRejectedValue(new Error("Late native cleanup failed"));
    loadActiveRuntimeLocalFolder.mockReturnValue("C:\\Notes");
    const { host, root } = await renderPicker();

    await act(async () => {
      host.querySelector<HTMLButtonElement>("button")?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledOnce();

    act(() => root.unmount());
  });
  it("does not report success when another activation wins the race", async () => {
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
    loadActiveRuntimeLocalFolder.mockReturnValue("D:/Other");
    const { host, root } = await renderPicker();

    await act(async () => {
      host.querySelector<HTMLButtonElement>("button")?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      "Could not connect the local library",
      expect.objectContaining({
        description: expect.stringContaining("active local library changed"),
      })
    );

    act(() => root.unmount());
  });
});
