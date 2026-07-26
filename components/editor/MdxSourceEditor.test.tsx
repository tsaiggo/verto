// @vitest-environment jsdom

import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const caretMocks = vi.hoisted(() => ({
  position: { left: 40, top: 24, lineHeight: 20 },
}));

vi.mock("./mdx-source-editor-caret", () => ({
  clampEditorMenuPosition: (value: number, minimum: number, maximum: number) =>
    Math.min(Math.max(value, minimum), maximum),
  measureTextareaCaret: () => caretMocks.position,
  scrollTextareaSelectionIntoView: vi.fn(),
}));

import { MdxSourceEditor } from "./MdxSourceEditor";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

async function renderEditor(format: "md" | "mdx" = "mdx"): Promise<{
  host: HTMLDivElement;
  root: Root;
  textarea: HTMLTextAreaElement;
}> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  function Harness() {
    const [value, setValue] = useState("");
    return createElement(MdxSourceEditor, {
      value,
      format,
      onValueChange: setValue,
      "aria-label": "MDX source",
    });
  }

  await act(async () => root.render(createElement(Harness)));
  const textarea = host.querySelector("textarea");
  if (!textarea) throw new Error("Expected source textarea");
  return { host, root, textarea };
}

function replaceValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  setter?.call(textarea, value);
  textarea.setSelectionRange(value.length, value.length);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  caretMocks.position = { left: 40, top: 24, lineHeight: 20 };
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MdxSourceEditor", () => {
  it("filters and inserts a command while keeping focus in the textarea", async () => {
    const { host, root, textarea } = await renderEditor();
    textarea.focus();
    await act(async () => replaceValue(textarea, "/callout"));

    expect(textarea.getAttribute("role")).toBe("combobox");
    expect(textarea.getAttribute("aria-expanded")).toBe("true");
    expect(textarea.getAttribute("aria-controls")).toBeTruthy();
    expect(textarea.parentElement?.hasAttribute("role")).toBe(false);
    expect(textarea.parentElement?.hasAttribute("aria-expanded")).toBe(false);
    expect(host.querySelector("[role='listbox']")).not.toBeNull();
    expect(
      Array.from(host.querySelectorAll("[role='option']")).map((option) =>
        option.textContent?.trim()
      )
    ).toEqual([
      "NoteHighlight useful context",
      "TipShare a practical suggestion",
      "WarningCall out a risk",
    ]);

    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
      );
    });

    expect(textarea.value).toContain('<Callout type="info">');
    expect(textarea.value).toContain("Write a note.");
    expect(textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)).toBe(
      "Write a note."
    );
    expect(document.activeElement).toBe(textarea);
    expect(host.querySelector("[role='listbox']")).toBeNull();
    await act(async () => root.unmount());
  });

  it("uses the rendered listbox height when it flips above the caret", async () => {
    caretMocks.position = { left: 40, top: 180, lineHeight: 20 };
    const { host, root, textarea } = await renderEditor();
    const wrapper = textarea.parentElement;
    if (!wrapper) throw new Error("Expected editor wrapper");
    Object.defineProperties(wrapper, {
      clientHeight: { configurable: true, value: 240 },
      clientWidth: { configurable: true, value: 420 },
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement
    ) {
      const height = this.getAttribute("role") === "listbox" ? 72 : 0;
      return {
        bottom: height,
        height,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      };
    });

    textarea.focus();
    await act(async () => replaceValue(textarea, "/"));

    const menu = host.querySelector<HTMLElement>("[role='listbox']");
    expect(menu?.style.top).toBe("102px");
    await act(async () => root.unmount());
  });

  it("moves the active option with arrows and inserts it with Tab", async () => {
    const { host, root, textarea } = await renderEditor();
    textarea.focus();
    await act(async () => replaceValue(textarea, "/heading"));
    const firstActiveId = textarea.getAttribute("aria-activedescendant");
    expect(firstActiveId).toContain("heading-2");

    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })
      );
    });
    expect(textarea.getAttribute("aria-activedescendant")).toContain("heading-3");

    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })
      );
    });
    expect(textarea.value).toBe("### Subsection heading");
    expect(document.activeElement).toBe(textarea);
    expect(host.querySelector("[role='listbox']")).toBeNull();
    await act(async () => root.unmount());
  });

  it("closes on Escape without changing the query", async () => {
    const { host, root, textarea } = await renderEditor();
    textarea.focus();
    await act(async () => replaceValue(textarea, "/quo"));
    expect(host.querySelector("[role='listbox']")).not.toBeNull();

    await act(async () => {
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })
      );
      textarea.dispatchEvent(new Event("select", { bubbles: true }));
    });

    expect(textarea.value).toBe("/quo");
    expect(host.querySelector("[role='listbox']")).toBeNull();

    await act(async () => replaceValue(textarea, "/quot"));
    expect(host.querySelector("[role='listbox']")).not.toBeNull();
    await act(async () => root.unmount());
  });

  it("explains why rich commands are unavailable in Markdown", async () => {
    const { host, root, textarea } = await renderEditor("md");
    textarea.focus();
    await act(async () => replaceValue(textarea, "/callout"));

    expect(host.textContent).toContain("Rich blocks require an .mdx file.");
    expect(host.querySelectorAll("[role='option']")).toHaveLength(0);
    await act(async () => root.unmount());
  });

  it("does not submit a command while an IME composition is active", async () => {
    const { host, root, textarea } = await renderEditor();
    textarea.focus();
    await act(async () => replaceValue(textarea, "/note"));
    expect(host.querySelector("[role='listbox']")).not.toBeNull();

    await act(async () => {
      textarea.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      textarea.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
          isComposing: true,
        })
      );
    });

    expect(textarea.value).toBe("/note");
    await act(async () => root.unmount());
  });
});
