// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Annotation } from "@/lib/annotations";
import NoteComposer from "./NoteComposer";
import HighlightPopover from "./HighlightPopover";
import { annotationOverlayPosition } from "./useAnnotationOverlayPosition";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });

const viewport = { left: 0, top: 0, width: 320, height: 640 };
const size = { width: 288, height: 220 };

describe("annotation overlay placement", () => {
  it("keeps the existing gap below a visible passage when the dialog fits", () => {
    const position = annotationOverlayPosition(
      { x: 100, y: 100, width: 80, height: 24 },
      size,
      viewport
    );
    expect(position.top).toBe(132);
    expect(position.left).toBe(8);
  });

  it("flips the measured dialog above a passage near the bottom of a mobile viewport", () => {
    const position = annotationOverlayPosition(
      { x: 100, y: 600, width: 80, height: 24 },
      size,
      viewport
    );
    expect(position.top).toBe(372);
    expect(position.top + size.height).toBeLessThan(600);
  });

  it.each([
    { y: -300, top: 8 },
    { y: 900, top: 412 },
  ])("keeps controls at the nearest visible edge when the passage moves to $y", ({ y, top }) => {
    const position = annotationOverlayPosition(
      { x: 100, y, width: 80, height: 24 },
      size,
      viewport
    );
    expect(position.top).toBe(top);
    expect(position.top + size.height).toBeLessThanOrEqual(viewport.height - 8);
  });

  it("caps a growing dialog to the smaller visible viewport without losing the anchor", () => {
    const position = annotationOverlayPosition(
      { x: 100, y: 700, width: 80, height: 24 },
      { width: 288, height: 500 },
      { left: 0, top: 300, width: 320, height: 240 }
    );
    expect(position.maxHeight).toBe(224);
    expect(position.top).toBe(308);
    expect(position.top + position.maxHeight).toBe(532);
  });
});

describe("draft-preserving overlay movement", () => {
  let root: Root;
  let host: HTMLDivElement;
  const widthDescriptor = Object.getOwnPropertyDescriptor(window, "innerWidth")!;
  const heightDescriptor = Object.getOwnPropertyDescriptor(window, "innerHeight")!;

  beforeEach(() => {
    Object.defineProperties(window, {
      innerWidth: { configurable: true, value: 320 },
      innerHeight: { configurable: true, value: 640 },
    });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(220);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(288);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
    Object.defineProperty(window, "innerWidth", widthDescriptor);
    Object.defineProperty(window, "innerHeight", heightDescriptor);
    vi.restoreAllMocks();
  });

  function fillDraft(value: string) {
    const textarea = host.querySelector("textarea")!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
      textarea,
      value
    );
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    return textarea;
  }

  it("retains a composer draft while its passage scrolls offscreen and the viewport shrinks", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    act(() =>
      root.render(
        createElement(NoteComposer, {
          anchor: { quote: "Source", rect: { x: 100, y: 624, width: 80, height: 24 } },
          onSave,
          onCancel,
        })
      )
    );
    const dialog = host.querySelector<HTMLDivElement>("[role='dialog']")!;
    expect(dialog.style.top).toBe("372px");
    act(() => {
      fillDraft("Keep this thought.");
    });
    act(() =>
      root.render(
        createElement(NoteComposer, {
          anchor: { quote: "Source", rect: { x: 100, y: -200, width: 80, height: 24 } },
          onSave,
          onCancel,
        })
      )
    );
    expect(dialog.style.top).toBe("8px");
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 240 });
    act(() => window.dispatchEvent(new Event("resize")));
    expect(dialog.style.maxHeight).toBe("224px");
    expect(dialog.style.overflowY).toBe("auto");
    expect(host.querySelector("textarea")!.value).toBe("Keep this thought.");
    act(() => host.querySelector<HTMLButtonElement>(".annotation-btn-primary")!.click());
    expect(onSave).toHaveBeenCalledWith("Keep this thought.", "yellow");
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("retains the highlighted-note draft when the mark moves outside the viewport", () => {
    const annotation: Annotation = {
      id: "highlight",
      docSlug: "doc",
      quote: "Source",
      anchor: { quote: "Source", prefix: "", suffix: "", start: 0 },
      color: "yellow",
      turns: [],
      createdAt: "2026-10-06",
      updatedAt: "2026-10-06",
    };
    const onClose = vi.fn();
    act(() =>
      root.render(
        createElement(HighlightPopover, {
          annotation,
          anchor: { x: 100, y: 600, width: 80, height: 24 },
          onClose,
        })
      )
    );
    act(() => {
      fillDraft("Keep the revised thought.");
    });
    act(() =>
      root.render(
        createElement(HighlightPopover, {
          annotation,
          anchor: { x: 100, y: 900, width: 80, height: 24 },
          onClose,
        })
      )
    );
    const dialog = host.querySelector<HTMLDivElement>("[role='dialog']")!;
    expect(dialog.style.top).toBe("412px");
    expect(host.querySelector("textarea")!.value).toBe("Keep the revised thought.");
    expect(onClose).not.toHaveBeenCalled();
  });
});
