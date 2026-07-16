// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  summaries: [] as Array<Record<string, unknown>>,
  annotations: [] as Array<Record<string, unknown>>,
  listeners: new Set<() => void>(),
  saveSummary: vi.fn(),
  deleteSummary: vi.fn(),
  setAnnotationNote: vi.fn(),
  deleteAnnotation: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

function emit() {
  state.listeners.forEach((listener) => listener());
}

vi.mock("@/lib/state-store", () => ({
  getStateStore: () => ({
    subscribe(listener: () => void) {
      state.listeners.add(listener);
      return () => state.listeners.delete(listener);
    },
  }),
}));

vi.mock("@/lib/summaries", () => ({
  loadSummaries: () => ({ summaries: state.summaries }),
  saveSummary: state.saveSummary,
  deleteSummary: state.deleteSummary,
}));

vi.mock("@/lib/annotations", () => ({
  annotationNote: (annotation: { turns: Array<{ author: string; body: string }> }) =>
    annotation.turns.find((turn) => turn.author === "human")?.body ?? "",
  loadAnnotations: () => ({ annotations: state.annotations }),
  setAnnotationNote: state.setAnnotationNote,
  deleteAnnotation: state.deleteAnnotation,
}));

vi.mock("sonner", () => ({
  toast: { success: state.toastSuccess, error: state.toastError },
}));

import StudioCards from "./StudioCards";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const summary = {
  href: "/read/architecture",
  slug: ["architecture"],
  title: "Architecture",
  body: "A durable event pipeline with retries.",
  model: "test/model",
  createdAt: "2026-07-15T00:00:00.000Z",
};

async function renderStudio(): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(StudioCards));
  });
  return { host, root };
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

function button(name: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (item) => item.getAttribute("aria-label") === name || item.textContent?.trim() === name
  );
  if (!match) throw new Error(`Button not found: ${name}`);
  return match;
}

describe("StudioCards interactions", () => {
  beforeEach(() => {
    state.summaries = [{ ...summary }];
    state.annotations = [];
    state.listeners.clear();
    state.toastSuccess.mockReset();
    state.toastError.mockReset();
    state.saveSummary.mockReset().mockImplementation(async (next: Record<string, unknown>) => {
      state.summaries = [next];
      emit();
      return { summaries: state.summaries };
    });
    state.deleteSummary.mockReset().mockImplementation(async (href: string) => {
      state.summaries = state.summaries.filter((item) => item.href !== href);
      emit();
      return { summaries: state.summaries };
    });
    state.setAnnotationNote.mockReset().mockImplementation(async (id: string, note: string) => {
      state.annotations = state.annotations.map((item) =>
        item.id === id
          ? {
              ...item,
              turns: (item.turns as Array<Record<string, unknown>>).map((turn) =>
                turn.author === "human" ? { ...turn, body: note } : turn
              ),
            }
          : item
      );
      emit();
      return { annotations: state.annotations };
    });
    state.deleteAnnotation.mockReset().mockImplementation(async (id: string) => {
      state.annotations = state.annotations.filter((item) => item.id !== id);
      emit();
      return { annotations: state.annotations };
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("performs real search and copy actions", async () => {
    const { host, root } = await renderStudio();
    const search = host.querySelector<HTMLInputElement>("#studio-search");
    expect(search).not.toBeNull();

    await act(async () => setNativeValue(search!, "missing"));
    expect(host.textContent).toContain("No matching cards");

    await act(async () => button("Clear filters").click());
    expect(host.textContent).toContain("Architecture");

    await act(async () => button("Copy Architecture").click());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "Architecture\n\nA durable event pipeline with retries."
    );
    expect(state.toastSuccess).toHaveBeenCalledWith("Knowledge card copied");
    act(() => root.unmount());
  });

  it("persists edits and deliberate deletion through the artifact store", async () => {
    const { host, root } = await renderStudio();

    await act(async () => button("Edit Architecture").click());
    const textarea = document.querySelector<HTMLTextAreaElement>("#studio-card-content");
    expect(textarea).not.toBeNull();
    await act(async () => setNativeValue(textarea!, "Updated pipeline guidance."));
    await act(async () =>
      textarea
        ?.closest("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );

    expect(state.saveSummary).toHaveBeenCalledWith(
      expect.objectContaining({ body: "Updated pipeline guidance." })
    );
    expect(host.textContent).toContain("Updated pipeline guidance.");

    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')?.click();
    });
    await act(async () => button("Delete Architecture").click());
    await act(async () => button("Delete card").click());

    expect(state.deleteSummary).toHaveBeenCalledWith("/read/architecture");
    expect(host.textContent).toContain("No knowledge cards yet");
    act(() => root.unmount());
  });

  it("edits and deletes note cards through the annotation store", async () => {
    state.summaries = [];
    state.annotations = [
      {
        id: "note-1",
        docSlug: "architecture",
        quote: "Retry only when the operation is safe.",
        anchor: {
          quote: "Retry only when the operation is safe.",
          prefix: "",
          suffix: "",
          start: 0,
        },
        color: "yellow",
        turns: [
          {
            id: "turn-1",
            author: "human",
            body: "Remember the retry budget",
            createdAt: "2026-07-15T00:00:00.000Z",
          },
        ],
        createdAt: "2026-07-15T00:00:00.000Z",
        updatedAt: "2026-07-15T00:00:00.000Z",
      },
    ];
    const { host, root } = await renderStudio();

    await act(async () => button("Edit Remember the retry budget").click());
    const textarea = document.querySelector<HTMLTextAreaElement>("#studio-card-content");
    await act(async () => setNativeValue(textarea!, "Keep retries idempotent"));
    await act(async () =>
      textarea
        ?.closest("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );

    expect(state.setAnnotationNote).toHaveBeenCalledWith("note-1", "Keep retries idempotent");
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')?.click();
    });
    await act(async () => button("Delete Keep retries idempotent").click());
    await act(async () => button("Delete card").click());

    expect(state.deleteAnnotation).toHaveBeenCalledWith("note-1");
    expect(host.textContent).toContain("No knowledge cards yet");
    act(() => root.unmount());
  });
});
