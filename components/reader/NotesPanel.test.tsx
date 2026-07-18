// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Annotation } from "@/lib/annotations";

const mocks = vi.hoisted(() => ({
  annotations: [] as Annotation[],
  deleteAnnotation: vi.fn(),
  setAnnotationNote: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/annotations", () => ({
  annotationNote: (annotation: Annotation) =>
    annotation.turns.find((turn) => turn.author === "human")?.body ?? "",
  annotationsForDoc: (annotations: Annotation[], docSlug: string) =>
    annotations.filter((annotation) => annotation.docSlug === docSlug),
  deleteAnnotation: mocks.deleteAnnotation,
  loadAnnotations: () => ({ annotations: mocks.annotations }),
  setAnnotationNote: mocks.setAnnotationNote,
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

import NotesPanel from "@/components/reader/NotesPanel";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const DOC_SLUG = "reader-notes";

function annotationWithNote(note: string): Annotation {
  return {
    id: "annotation-1",
    docSlug: DOC_SLUG,
    quote: "A passage worth remembering",
    anchor: {
      quote: "A passage worth remembering",
      prefix: "Before ",
      suffix: " after",
      start: 7,
    },
    color: "yellow",
    turns: note
      ? [
          {
            id: "turn-1",
            author: "human",
            body: note,
            createdAt: "2026-07-17T00:00:00.000Z",
          },
        ]
      : [],
    createdAt: "2026-07-17T00:00:00.000Z",
    updatedAt: "2026-07-17T00:00:00.000Z",
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function notifyAnnotationsChanged() {
  window.dispatchEvent(new Event("storage"));
}

let root: Root | null = null;

async function renderPanel(): Promise<HTMLDivElement> {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(createElement(NotesPanel, { docSlug: DOC_SLUG })));
  return host;
}

async function editNote(host: HTMLElement, value: string): Promise<HTMLTextAreaElement> {
  await act(async () => {
    host.querySelector<HTMLButtonElement>('[aria-label="Edit note"]')?.click();
  });

  const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
  expect(textarea).not.toBeNull();
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setValue?.call(textarea, value);
    textarea?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return textarea!;
}

beforeEach(() => {
  mocks.annotations = [annotationWithNote("Original note")];
  mocks.deleteAnnotation.mockReset();
  mocks.setAnnotationNote.mockReset();
  mocks.toastError.mockReset();
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  document.body.replaceChildren();
});

describe("NotesPanel persistence failures", () => {
  it("keeps the draft editable and reports a save that was not applied locally", async () => {
    const pending = deferred<never>();
    mocks.setAnnotationNote.mockReturnValue(pending.promise);
    const host = await renderPanel();
    const textarea = await editNote(host, "Unsaved draft");
    const save = host.querySelector<HTMLButtonElement>('[aria-label="Save note"]');
    const cancel = host.querySelector<HTMLButtonElement>('[aria-label="Cancel"]');

    await act(async () => {
      save?.click();
      await Promise.resolve();
    });

    expect(save?.disabled).toBe(true);
    expect(cancel?.disabled).toBe(true);
    expect(textarea.disabled).toBe(true);
    expect(mocks.setAnnotationNote).toHaveBeenCalledWith("annotation-1", "Unsaved draft");

    await act(async () => {
      pending.reject(new Error("storage unavailable"));
      await Promise.resolve();
    });

    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("Unsaved draft");
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Save note"]')?.disabled).toBe(false);
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't save note",
      expect.objectContaining({ description: expect.stringContaining("draft is still here") })
    );
  });

  it("closes the editor without a duplicate toast when a rejected save was applied locally", async () => {
    mocks.setAnnotationNote.mockImplementation(async (_id: string, note: string) => {
      mocks.annotations = [annotationWithNote(note)];
      notifyAnnotationsChanged();
      throw new Error("desktop mirror failed");
    });
    const host = await renderPanel();
    await editNote(host, "Saved on this device");

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[aria-label="Save note"]')?.click();
      await Promise.resolve();
    });

    expect(host.querySelector("textarea")).toBeNull();
    expect(host.textContent).toContain("Saved on this device");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("keeps the row, re-enables delete, and reports a deletion not applied locally", async () => {
    const pending = deferred<never>();
    mocks.deleteAnnotation.mockReturnValue(pending.promise);
    const host = await renderPanel();
    const remove = host.querySelector<HTMLButtonElement>('[aria-label="Delete note"]');

    await act(async () => {
      remove?.click();
      await Promise.resolve();
    });
    expect(remove?.disabled).toBe(true);

    await act(async () => {
      pending.reject(new Error("storage unavailable"));
      await Promise.resolve();
    });

    expect(host.textContent).toContain("Original note");
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Delete note"]')?.disabled).toBe(
      false
    );
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't delete note",
      expect.objectContaining({ description: expect.stringContaining("still here") })
    );
  });

  it("does not duplicate the store error when a rejected deletion was applied locally", async () => {
    mocks.deleteAnnotation.mockImplementation(async () => {
      mocks.annotations = [];
      notifyAnnotationsChanged();
      throw new Error("desktop mirror failed");
    });
    const host = await renderPanel();

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[aria-label="Delete note"]')?.click();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("Select any text to highlight it");
    expect(host.querySelector('[aria-label="Delete note"]')).toBeNull();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
