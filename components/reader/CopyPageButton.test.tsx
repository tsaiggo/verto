// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  writeText: vi.fn(),
  execCommand: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: state.toastError } }));

import CopyPageButton from "./CopyPageButton";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

async function renderCopyButton(): Promise<{
  host: HTMLDivElement;
  root: Root;
  button: HTMLButtonElement;
}> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      createElement(
        "article",
        { className: "main" },
        createElement("p", null, "Readable article body"),
        createElement(CopyPageButton)
      )
    )
  );
  const button = host.querySelector<HTMLButtonElement>('button[aria-label="Copy page"]');
  if (!button) throw new Error("Missing copy-page button");
  return { host, root, button };
}

async function click(target: HTMLButtonElement): Promise<void> {
  await act(async () => {
    target.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("CopyPageButton", () => {
  beforeEach(() => {
    state.writeText.mockReset();
    state.execCommand.mockReset();
    state.toastError.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: state.writeText },
    });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: state.execCommand,
    });
    Object.defineProperty(HTMLElement.prototype, "innerText", {
      configurable: true,
      get() {
        return this.textContent ?? "";
      },
      set(value: string) {
        this.textContent = value;
      },
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("disables the control while the clipboard write is pending", async () => {
    let resolveWrite!: () => void;
    state.writeText.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveWrite = resolve;
      })
    );
    const { host, root, button } = await renderCopyButton();

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-label")).toBe("Copying page");
    expect(host.textContent).toContain("Copying…");

    await act(async () => {
      resolveWrite();
      await Promise.resolve();
    });

    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-label")).toBe("Copied");
    expect(state.toastError).not.toHaveBeenCalled();

    act(() => root.unmount());
  });

  it("uses the legacy fallback only when it truthfully reports success", async () => {
    state.writeText.mockRejectedValue(new Error("permission denied"));
    state.execCommand.mockReturnValue(true);
    const { root, button } = await renderCopyButton();

    await click(button);

    expect(state.execCommand).toHaveBeenCalledWith("copy");
    expect(button.getAttribute("aria-label")).toBe("Copied");
    expect(state.toastError).not.toHaveBeenCalled();
    expect(document.querySelector("textarea")).toBeNull();

    act(() => root.unmount());
  });

  it("reports clipboard failure instead of showing a false Copied state", async () => {
    state.writeText.mockRejectedValue(new Error("permission denied"));
    state.execCommand.mockReturnValue(false);
    const { host, root, button } = await renderCopyButton();

    await click(button);

    expect(button.getAttribute("aria-label")).toBe("Copy page");
    expect(host.textContent).not.toContain("Copied");
    expect(state.toastError).toHaveBeenCalledWith("Couldn't copy page", {
      description: "Clipboard access is unavailable. Check your browser permissions and retry.",
    });
    expect(document.querySelector("textarea")).toBeNull();

    act(() => root.unmount());
  });
});
