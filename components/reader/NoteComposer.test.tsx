// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import NoteComposer from "@/components/reader/NoteComposer";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function buttonWithText(host: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === text
    ) ?? null
  );
}

let root: Root | null = null;

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  document.body.replaceChildren();
});

describe("NoteComposer pending state", () => {
  it("trims the submitted note, locks every control, blocks Escape, then restores controls", async () => {
    const pending = deferred<void>();
    const onSave = vi.fn(() => pending.promise);
    const onCancel = vi.fn();
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () =>
      root?.render(
        createElement(NoteComposer, {
          anchor: {
            quote: "A selected passage",
            rect: { x: 100, y: 50, width: 120, height: 24 },
          },
          onSave,
          onCancel,
        })
      )
    );

    const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    await act(async () => {
      setValue?.call(textarea, "  Keep only the idea  ");
      textarea?.dispatchEvent(new Event("input", { bubbles: true }));
      host.querySelector<HTMLButtonElement>('[role="radio"][aria-label="Green"]')?.click();
    });

    await act(async () => {
      buttonWithText(host, "Save")?.click();
      await Promise.resolve();
    });

    const dialog = host.querySelector<HTMLElement>('[role="dialog"]');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith("Keep only the idea", "green");
    expect(dialog?.getAttribute("aria-busy")).toBe("true");
    expect(textarea?.disabled).toBe(true);
    expect(
      Array.from(host.querySelectorAll<HTMLButtonElement>("button")).every(
        (button) => button.disabled
      )
    ).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    buttonWithText(host, "Saving…")?.click();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });

    expect(dialog?.getAttribute("aria-busy")).toBe("false");
    expect(textarea?.disabled).toBe(false);
    expect(buttonWithText(host, "Save")?.disabled).toBe(false);
    expect(buttonWithText(host, "Cancel")?.disabled).toBe(false);
    expect(
      Array.from(host.querySelectorAll<HTMLButtonElement>('[role="radio"]')).every(
        (button) => !button.disabled
      )
    ).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
