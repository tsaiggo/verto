// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  mode: "fail" as "fail" | "mirror",
  candidate: null as Record<string, unknown> | null,
  saveAnnotation: vi.fn(),
  toastError: vi.fn(),
  removeAllRanges: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: state.toastError } }));

vi.mock("@/lib/annotation-anchor", () => ({
  describeRange: () => ({ quote: "hello", prefix: "", suffix: " world", start: 0 }),
  locateAnchor: () => null,
}));

vi.mock("@/lib/annotation-dom", () => ({
  articleText: () => "hello world",
  clearAnnotationHighlights: vi.fn(),
  flashPaint: vi.fn(),
  getArticleRoot: () => document.body,
  paintAnnotation: () => [],
  rangeToOffsets: () => ({ start: 0, end: 5 }),
}));

vi.mock("@/lib/annotations", () => ({
  loadAnnotations: () => ({
    annotations: state.mode === "mirror" && state.candidate ? [state.candidate] : [],
  }),
  saveAnnotation: state.saveAnnotation,
}));

vi.mock("@/components/reader/use-doc-annotations", () => ({
  useDocAnnotations: () => [],
}));

vi.mock("@/components/ui/use-article-selection", () => ({
  useArticleSelection: () => ({
    rect: { x: 24, y: 48, width: 120, height: 20 },
    text: "hello",
    isActive: true,
  }),
}));

vi.mock("@/components/reader/use-mark-interactions", () => ({
  useMarkInteractions: vi.fn(),
}));

vi.mock("@/lib/ai", () => ({ getAssistantConfig: () => ({ enabled: false }) }));
vi.mock("@/lib/ai/ask-event", () => ({ dispatchAskAI: vi.fn() }));

vi.mock("@/components/reader/SelectionToolbar", () => ({
  default: ({ onHighlight, onNote }: { onHighlight: () => void; onNote: () => void }) =>
    createElement(
      "div",
      null,
      createElement("button", { type: "button", onClick: onHighlight }, "Add highlight"),
      createElement("button", { type: "button", onClick: onNote }, "Add note")
    ),
}));

vi.mock("@/components/reader/NoteComposer", () => ({
  default: ({ onSave }: { onSave: (note: string, color: "yellow") => Promise<void> }) =>
    createElement(
      "button",
      { type: "button", onClick: () => void onSave("Draft note", "yellow") },
      "Save note"
    ),
}));

vi.mock("@/components/reader/HighlightPopover", () => ({ default: () => null }));

import AnnotationsLayer from "./AnnotationsLayer";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

function button(host: HTMLElement, label: string): HTMLButtonElement {
  const match = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
    (item) => item.textContent === label
  );
  if (!match) throw new Error(`Missing button: ${label}`);
  return match;
}

async function renderLayer(): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      createElement(AnnotationsLayer, {
        docSlug: "demo",
        share: { title: "Demo", author: "Verto", tags: [], href: "/demo" },
      })
    )
  );
  return { host, root };
}

async function click(target: HTMLButtonElement): Promise<void> {
  await act(async () => {
    target.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("AnnotationsLayer persistence truth", () => {
  beforeEach(() => {
    state.mode = "fail";
    state.candidate = null;
    state.toastError.mockReset();
    state.removeAllRanges.mockReset();
    state.saveAnnotation.mockReset().mockImplementation(async (candidate) => {
      state.candidate = candidate as Record<string, unknown>;
      throw new Error("portable write failed");
    });
    vi.spyOn(window, "getSelection").mockReturnValue({
      rangeCount: 1,
      getRangeAt: () => document.createRange(),
      removeAllRanges: state.removeAllRanges,
    } as unknown as Selection);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("keeps a note composer open when the annotation was not stored", async () => {
    const { host, root } = await renderLayer();
    await click(button(host, "Add note"));
    await click(button(host, "Save note"));

    expect(state.saveAnnotation).toHaveBeenCalledOnce();
    expect(button(host, "Save note")).toBeTruthy();
    expect(state.removeAllRanges).not.toHaveBeenCalled();
    expect(state.toastError).toHaveBeenCalledWith("Couldn't save note", {
      description: "Your draft is still here. Check that local storage is available, then retry.",
    });

    act(() => root.unmount());
  });

  it("closes the composer without duplicate feedback when only the portable mirror failed", async () => {
    state.mode = "mirror";
    const { host, root } = await renderLayer();
    await click(button(host, "Add note"));
    await click(button(host, "Save note"));

    expect(host.textContent).not.toContain("Save note");
    expect(state.removeAllRanges).toHaveBeenCalledOnce();
    expect(state.toastError).not.toHaveBeenCalled();

    act(() => root.unmount());
  });

  it("keeps the selection active and reports a bare-highlight write failure", async () => {
    const { host, root } = await renderLayer();
    await click(button(host, "Add highlight"));

    expect(state.saveAnnotation).toHaveBeenCalledOnce();
    expect(state.removeAllRanges).not.toHaveBeenCalled();
    expect(state.toastError).toHaveBeenCalledWith("Couldn't save highlight", {
      description:
        "Your selection is still active. Check that local storage is available, then retry.",
    });

    act(() => root.unmount());
  });
});
