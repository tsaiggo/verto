// @vitest-environment jsdom

import { act, createElement, useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Annotation } from "@/lib/annotations";

const mocks = vi.hoisted(() => ({
  annotations: [] as Annotation[],
  deleteAnnotation: vi.fn(),
  onClose: vi.fn(),
  setAnnotationColor: vi.fn(),
  setAnnotationNote: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/annotations", () => ({
  annotationNote: (annotation: Annotation) =>
    annotation.turns.find((turn) => turn.author === "human")?.body ?? "",
  deleteAnnotation: mocks.deleteAnnotation,
  loadAnnotations: () => ({ annotations: mocks.annotations }),
  setAnnotationColor: mocks.setAnnotationColor,
  setAnnotationNote: mocks.setAnnotationNote,
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

import HighlightPopover from "@/components/reader/HighlightPopover";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

function annotationWith({
  color = "yellow",
  note = "Original note",
}: {
  color?: string;
  note?: string;
} = {}): Annotation {
  return {
    id: "annotation-1",
    docSlug: "reader-notes",
    quote: "A passage worth remembering",
    anchor: {
      quote: "A passage worth remembering",
      prefix: "Before ",
      suffix: " after",
      start: 7,
    },
    color,
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

function subscribeToAnnotations(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function annotationSnapshot() {
  return JSON.stringify(mocks.annotations[0] ?? null);
}

function HighlightHarness() {
  const snapshot = useSyncExternalStore(subscribeToAnnotations, annotationSnapshot, () => "null");
  const annotation = JSON.parse(snapshot) as Annotation | null;
  return annotation
    ? createElement(HighlightPopover, {
        annotation,
        anchor: { x: 100, y: 50, width: 120, height: 24 },
        onClose: mocks.onClose,
      })
    : null;
}

function notifyAnnotationsChanged() {
  window.dispatchEvent(new Event("storage"));
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

function buttonWithText(host: HTMLElement, text: string): HTMLButtonElement | null {
  return (
    Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === text
    ) ?? null
  );
}

async function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  await act(async () => {
    setValue?.call(textarea, value);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

let root: Root | null = null;

async function renderPopover(): Promise<HTMLDivElement> {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(createElement(HighlightHarness)));
  return host;
}

async function beginEditing(host: HTMLElement, draft: string) {
  await act(async () => buttonWithText(host, "Edit")?.click());
  const textarea = host.querySelector<HTMLTextAreaElement>("textarea");
  expect(textarea).not.toBeNull();
  await setTextareaValue(textarea!, draft);
  return textarea!;
}

beforeEach(() => {
  mocks.annotations = [annotationWith()];
  mocks.deleteAnnotation.mockReset();
  mocks.onClose.mockReset();
  mocks.setAnnotationColor.mockReset();
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

describe("HighlightPopover persistence failures", () => {
  it("keeps the draft and dialog open when saving was not applied locally", async () => {
    const pending = deferred<never>();
    mocks.setAnnotationNote.mockReturnValue(pending.promise);
    const host = await renderPopover();
    const textarea = await beginEditing(host, "  Unsaved draft  ");

    await act(async () => {
      buttonWithText(host, "Save")?.click();
      await Promise.resolve();
    });

    const dialog = host.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.getAttribute("aria-busy")).toBe("true");
    expect(textarea.disabled).toBe(true);
    expect(
      Array.from(host.querySelectorAll<HTMLButtonElement>("button")).every(
        (button) => button.disabled
      )
    ).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(mocks.onClose).not.toHaveBeenCalled();
    expect(mocks.setAnnotationNote).toHaveBeenCalledWith("annotation-1", "Unsaved draft");

    await act(async () => {
      pending.reject(new Error("storage unavailable"));
      await Promise.resolve();
    });

    expect(host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("  Unsaved draft  ");
    expect(host.querySelector<HTMLElement>('[role="dialog"]')?.getAttribute("aria-busy")).toBe(
      "false"
    );
    expect(mocks.onClose).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't save note",
      expect.objectContaining({ description: expect.stringContaining("draft is still here") })
    );
  });

  it("keeps the previous color when recoloring was not applied locally", async () => {
    mocks.setAnnotationColor.mockRejectedValue(new Error("storage unavailable"));
    const host = await renderPopover();

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[role="radio"][aria-label="Blue"]')?.click();
      await Promise.resolve();
    });

    expect(mocks.setAnnotationColor).toHaveBeenCalledWith("annotation-1", "blue");
    expect(
      host
        .querySelector<HTMLButtonElement>('[role="radio"][aria-label="Amber"]')
        ?.getAttribute("aria-checked")
    ).toBe("true");
    expect(
      host
        .querySelector<HTMLButtonElement>('[role="radio"][aria-label="Blue"]')
        ?.getAttribute("aria-checked")
    ).toBe("false");
    expect(mocks.onClose).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't change highlight color",
      expect.objectContaining({ description: expect.stringContaining("previous color") })
    );
  });

  it("keeps the popover open when deletion was not applied locally", async () => {
    mocks.deleteAnnotation.mockRejectedValue(new Error("storage unavailable"));
    const host = await renderPopover();

    await act(async () => {
      buttonWithText(host, "Delete")?.click();
      await Promise.resolve();
    });

    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(buttonWithText(host, "Delete")?.disabled).toBe(false);
    expect(mocks.onClose).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't delete highlight",
      expect.objectContaining({ description: expect.stringContaining("still saved") })
    );
  });

  it("finishes a mirror-only rejected save from the locally stored note without another toast", async () => {
    mocks.setAnnotationNote.mockImplementation(async (_id: string, note: string) => {
      mocks.annotations = [annotationWith({ note })];
      notifyAnnotationsChanged();
      throw new Error("desktop mirror failed");
    });
    const host = await renderPopover();
    await beginEditing(host, "Saved on this device");

    await act(async () => {
      buttonWithText(host, "Save")?.click();
      await Promise.resolve();
    });

    expect(host.querySelector("textarea")).toBeNull();
    expect(host.textContent).toContain("Saved on this device");
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.onClose).not.toHaveBeenCalled();
  });

  it("accepts a mirror-only rejected recolor from the locally stored color without another toast", async () => {
    mocks.setAnnotationColor.mockImplementation(async (_id: string, color: string) => {
      mocks.annotations = [annotationWith({ color })];
      notifyAnnotationsChanged();
      throw new Error("desktop mirror failed");
    });
    const host = await renderPopover();

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[role="radio"][aria-label="Blue"]')?.click();
      await Promise.resolve();
    });

    expect(
      host
        .querySelector<HTMLButtonElement>('[role="radio"][aria-label="Blue"]')
        ?.getAttribute("aria-checked")
    ).toBe("true");
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.onClose).not.toHaveBeenCalled();
  });

  it("closes after a mirror-only rejected deletion has already removed the local annotation", async () => {
    mocks.deleteAnnotation.mockImplementation(async () => {
      mocks.annotations = [];
      notifyAnnotationsChanged();
      throw new Error("desktop mirror failed");
    });
    const host = await renderPopover();

    await act(async () => {
      buttonWithText(host, "Delete")?.click();
      await Promise.resolve();
    });

    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(mocks.onClose).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
