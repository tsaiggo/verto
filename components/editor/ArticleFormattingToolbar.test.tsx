// @vitest-environment jsdom

import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleSourcePane } from "./ArticleSourcePane";
import { articleFormatting } from "./ArticleFormattingToolbar";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
let root: Root;
let host: HTMLDivElement;

function Fixture({ onAskAi = vi.fn() }: { onAskAi?: (text: string) => void }) {
  const [source, setSource] = useState("Before 中文 words after\n");
  return createElement(ArticleSourcePane, {
    source,
    format: "md",
    onSourceChange: setSource,
    readOnly: false,
    onAskAi,
  });
}

function select(start: number, end: number) {
  const textarea = host.querySelector<HTMLTextAreaElement>("textarea")!;
  textarea.focus();
  textarea.setSelectionRange(start, end);
  textarea.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift", bubbles: true }));
  return textarea;
}

describe("Article formatting selection", () => {
  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });
  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("preserves surrounding portable source and selects the actual link destination", () => {
    const source = "前面\r\nselected\r\n后面";
    const formatted = articleFormatting(source, 4, 12, "link");
    expect(formatted.source).toBe("前面\r\n[selected](https://)\r\n后面");
    expect(formatted.source.slice(formatted.start, formatted.end)).toBe("https://");
  });

  it("formats only the selection and returns focus and selection to the textarea", async () => {
    await act(async () => root.render(createElement(Fixture)));
    let textarea!: HTMLTextAreaElement;
    act(() => {
      textarea = select(7, 9);
    });
    expect(host.querySelector("[role='toolbar']")).not.toBeNull();
    act(() => host.querySelector<HTMLButtonElement>("button[aria-label='Bold']")!.click());
    expect(textarea.value).toBe("Before **中文** words after\n");
    expect(textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)).toBe("**中文**");
    expect(document.activeElement).toBe(textarea);
  });

  it("keeps formatting out of IME composition and dismisses it with Escape", async () => {
    await act(async () => root.render(createElement(Fixture)));
    let textarea!: HTMLTextAreaElement;
    act(() => {
      textarea = select(7, 9);
    });
    act(() => textarea.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));
    expect(host.querySelector("[role='toolbar']")).toBeNull();
    act(() =>
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "b",
          ctrlKey: true,
          isComposing: true,
          bubbles: true,
          cancelable: true,
        })
      )
    );
    expect(textarea.value).toBe("Before 中文 words after\n");
    act(() => textarea.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })));
    act(() => {
      select(7, 9);
    });
    act(() =>
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
      )
    );
    expect(host.querySelector("[role='toolbar']")).toBeNull();
    expect(textarea.value).toBe("Before 中文 words after\n");
  });

  it("passes the real selection to the AI review without changing the draft", async () => {
    const onAskAi = vi.fn();
    await act(async () => root.render(createElement(Fixture, { onAskAi })));
    let textarea!: HTMLTextAreaElement;
    act(() => {
      textarea = select(7, 9);
    });
    act(() =>
      host
        .querySelector<HTMLButtonElement>("button[aria-label='Ask AI about selected text']")!
        .click()
    );
    expect(onAskAi).toHaveBeenCalledWith("中文");
    expect(textarea.value).toBe("Before 中文 words after\n");
  });
});
