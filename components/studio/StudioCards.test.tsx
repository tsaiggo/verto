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

const note = {
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

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
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

  it("blocks duplicate submit and close while a save is pending", async () => {
    const pending = deferred();
    state.saveSummary.mockReturnValue(pending.promise);
    const { root } = await renderStudio();

    await act(async () => button("Edit Architecture").click());
    const textarea = document.querySelector<HTMLTextAreaElement>("#studio-card-content");
    await act(async () => setNativeValue(textarea!, "Pending pipeline guidance."));
    const save = button("Save changes");

    await act(async () => {
      save.click();
      save.click();
      await Promise.resolve();
    });

    expect(state.saveSummary).toHaveBeenCalledTimes(1);
    expect(save.disabled).toBe(true);
    expect(save.getAttribute("aria-busy")).toBe("true");
    expect(save.textContent).toBe("Saving");

    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')?.click();
      await Promise.resolve();
    });
    expect(document.querySelector("#studio-card-content")).not.toBeNull();

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(document.querySelector("#studio-card-content")).toBeNull();
    expect(state.toastSuccess).toHaveBeenCalledWith("Knowledge card updated");
    act(() => root.unmount());
  });

  it("blocks duplicate submit and close while a deletion is pending", async () => {
    const pending = deferred();
    state.deleteSummary.mockReturnValue(pending.promise);
    const { root } = await renderStudio();

    await act(async () => button("Delete Architecture").click());
    const remove = button("Delete card");
    await act(async () => {
      remove.click();
      remove.click();
      await Promise.resolve();
    });

    expect(state.deleteSummary).toHaveBeenCalledTimes(1);
    expect(remove.disabled).toBe(true);
    expect(remove.getAttribute("aria-busy")).toBe("true");
    expect(remove.textContent).toBe("Deleting");

    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')?.click();
      await Promise.resolve();
    });
    expect(document.body.textContent).toContain("Delete knowledge card?");

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();
    expect(state.toastSuccess).toHaveBeenCalledWith("Knowledge card deleted");
    act(() => root.unmount());
  });

  it("keeps a failed edit intact, reports it, and allows retry", async () => {
    state.saveSummary.mockRejectedValueOnce(new Error("storage unavailable"));
    const { host, root } = await renderStudio();

    await act(async () => button("Edit Architecture").click());
    const textarea = document.querySelector<HTMLTextAreaElement>("#studio-card-content");
    await act(async () => setNativeValue(textarea!, "Retry this pipeline update."));
    const save = button("Save changes");
    await act(async () => {
      save.click();
      await Promise.resolve();
    });

    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "The card could not be saved. Try again."
    );
    expect(textarea?.value).toBe("Retry this pipeline update.");
    expect(save.disabled).toBe(false);
    expect(save.getAttribute("aria-busy")).toBe("false");
    expect(state.toastError).toHaveBeenCalledWith("Couldn't update knowledge card", {
      description: "The card could not be saved. Try again.",
    });

    await act(async () => {
      save.click();
      await Promise.resolve();
    });
    expect(state.saveSummary).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("Retry this pipeline update.");
    expect(state.toastSuccess).toHaveBeenCalledWith("Knowledge card updated");
    act(() => root.unmount());
  });

  it("keeps a failed deletion open, reports it, and allows retry", async () => {
    state.deleteSummary.mockRejectedValueOnce(new Error("storage unavailable"));
    const { host, root } = await renderStudio();

    await act(async () => button("Delete Architecture").click());
    const remove = button("Delete card");
    await act(async () => {
      remove.click();
      await Promise.resolve();
    });

    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "The card could not be deleted. Try again."
    );
    expect(document.body.textContent).toContain("Delete knowledge card?");
    expect(remove.disabled).toBe(false);
    expect(remove.getAttribute("aria-busy")).toBe("false");
    expect(state.toastError).toHaveBeenCalledWith("Couldn't delete knowledge card", {
      description: "The card could not be deleted. Try again.",
    });

    await act(async () => {
      remove.click();
      await Promise.resolve();
    });
    expect(state.deleteSummary).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("No knowledge cards yet");
    expect(state.toastSuccess).toHaveBeenCalledWith("Knowledge card deleted");
    act(() => root.unmount());
  });

  it("accepts summary writes that applied locally before mirror rejection", async () => {
    state.saveSummary.mockImplementationOnce(async (next: Record<string, unknown>) => {
      state.summaries = [next];
      emit();
      throw new Error("portable mirror unavailable");
    });
    state.deleteSummary.mockImplementationOnce(async (href: string) => {
      state.summaries = state.summaries.filter((item) => item.href !== href);
      emit();
      throw new Error("portable mirror unavailable");
    });
    const { host, root } = await renderStudio();

    await act(async () => button("Edit Architecture").click());
    const textarea = document.querySelector<HTMLTextAreaElement>("#studio-card-content");
    await act(async () => setNativeValue(textarea!, "Locally applied summary."));
    await act(async () => {
      button("Save changes").click();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("Locally applied summary.");
    expect(state.toastError).not.toHaveBeenCalled();
    expect(state.toastSuccess).toHaveBeenCalledWith("Knowledge card updated");

    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')?.click();
    });
    await act(async () => button("Delete Architecture").click());
    await act(async () => {
      button("Delete card").click();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("No knowledge cards yet");
    expect(state.toastError).not.toHaveBeenCalled();
    expect(state.toastSuccess).toHaveBeenCalledWith("Knowledge card deleted");
    act(() => root.unmount());
  });

  it("accepts annotation writes that applied locally before mirror rejection", async () => {
    state.summaries = [];
    state.annotations = [{ ...note }];
    state.setAnnotationNote.mockImplementationOnce(async (id: string, nextNote: string) => {
      state.annotations = state.annotations.map((item) =>
        item.id === id
          ? {
              ...item,
              turns: (item.turns as Array<Record<string, unknown>>).map((turn) =>
                turn.author === "human" ? { ...turn, body: nextNote } : turn
              ),
            }
          : item
      );
      emit();
      throw new Error("portable mirror unavailable");
    });
    state.deleteAnnotation.mockImplementationOnce(async (id: string) => {
      state.annotations = state.annotations.filter((item) => item.id !== id);
      emit();
      throw new Error("portable mirror unavailable");
    });
    const { host, root } = await renderStudio();

    await act(async () => button("Edit Remember the retry budget").click());
    const textarea = document.querySelector<HTMLTextAreaElement>("#studio-card-content");
    await act(async () => setNativeValue(textarea!, "Locally applied note"));
    await act(async () => {
      button("Save changes").click();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("Locally applied note");
    expect(state.toastError).not.toHaveBeenCalled();
    expect(state.toastSuccess).toHaveBeenCalledWith("Knowledge card updated");

    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')?.click();
    });
    await act(async () => button("Delete Locally applied note").click());
    await act(async () => {
      button("Delete card").click();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("No knowledge cards yet");
    expect(state.toastError).not.toHaveBeenCalled();
    expect(state.toastSuccess).toHaveBeenCalledWith("Knowledge card deleted");
    act(() => root.unmount());
  });

  it("edits and deletes note cards through the annotation store", async () => {
    state.summaries = [];
    state.annotations = [{ ...note }];
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
