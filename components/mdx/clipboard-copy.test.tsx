// @vitest-environment jsdom

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  writeText: vi.fn(),
  execCommand: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: state.toastError } }));

import CodeBlock from "./CodeBlock";
import PackageInstall from "./PackageInstall";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

async function render(element: ReactElement): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(element);
    await Promise.resolve();
  });

  return { host, root };
}

async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function findButton(host: HTMLElement, selector: string): HTMLButtonElement {
  const button = host.querySelector<HTMLButtonElement>(selector);
  if (!button) throw new Error(`Missing copy button: ${selector}`);
  return button;
}

function cleanup(root: Root, host: HTMLElement): void {
  act(() => root.unmount());
  host.remove();
}

describe("MDX clipboard controls", () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1)
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("shows PackageInstall success when the verified legacy fallback succeeds", async () => {
    state.writeText.mockRejectedValue(new Error("permission denied"));
    state.execCommand.mockReturnValue(true);
    const { host, root } = await render(createElement(PackageInstall, { name: "verto" }));
    const button = findButton(host, ".pkg-install-copy");

    await click(button);

    expect(state.writeText).toHaveBeenCalledWith("npm install verto");
    expect(state.execCommand).toHaveBeenCalledWith("copy");
    expect(button.getAttribute("aria-label")).toBe("Copied");
    expect(state.toastError).not.toHaveBeenCalled();
    expect(document.querySelector("textarea")).toBeNull();

    cleanup(root, host);
  });

  it("keeps PackageInstall in its idle state and reports a complete copy failure", async () => {
    state.writeText.mockRejectedValue(new Error("permission denied"));
    state.execCommand.mockReturnValue(false);
    const { host, root } = await render(createElement(PackageInstall, { name: "verto" }));
    const button = findButton(host, ".pkg-install-copy");

    await click(button);

    expect(button.getAttribute("aria-label")).toBe("Copy command");
    expect(state.toastError).toHaveBeenCalledWith("Couldn't copy command", {
      description: "Clipboard access is unavailable. Check your browser permissions and retry.",
    });
    expect(document.querySelector("textarea")).toBeNull();

    cleanup(root, host);
  });

  it("shows CodeBlock success only after the Clipboard API resolves", async () => {
    state.writeText.mockResolvedValue(undefined);
    const { host, root } = await render(
      createElement(
        CodeBlock,
        null,
        createElement("code", null, "const answer = 42; // [!code ++]")
      )
    );
    const button = findButton(host, ".copy-btn");

    await click(button);

    expect(state.writeText).toHaveBeenCalledWith("const answer = 42;");
    expect(state.execCommand).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-label")).toBe("Copied");
    expect(state.toastError).not.toHaveBeenCalled();

    cleanup(root, host);
  });

  it("does not let a false legacy result put CodeBlock in a Copied state", async () => {
    state.writeText.mockRejectedValue(new Error("permission denied"));
    state.execCommand.mockReturnValue(false);
    const { host, root } = await render(
      createElement(CodeBlock, null, createElement("code", null, "const answer = 42;"))
    );
    const button = findButton(host, ".copy-btn");

    await click(button);

    expect(button.getAttribute("aria-label")).toBe("Copy code");
    expect(button.textContent).not.toContain("Copied");
    expect(state.toastError).toHaveBeenCalledWith("Couldn't copy code", {
      description: "Clipboard access is unavailable. Check your browser permissions and retry.",
    });
    expect(document.querySelector("textarea")).toBeNull();

    cleanup(root, host);
  });
});
