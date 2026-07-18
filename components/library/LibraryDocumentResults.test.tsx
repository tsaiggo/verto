// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryDoc } from "@/components/library/LibraryBrowser";

const mocks = vi.hoisted(() => ({
  loadBookmarks: vi.fn(),
  toastError: vi.fn(),
  toggleBookmark: vi.fn(),
}));

vi.mock("@/lib/bookmarks", () => ({
  loadBookmarks: mocks.loadBookmarks,
  toggleBookmark: mocks.toggleBookmark,
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

import LibraryDocumentResults from "./LibraryDocumentResults";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const DOCUMENT: LibraryDoc = {
  title: "Durable note",
  ext: ".md",
  href: "/read/durable-note",
  section: "Workspace",
  tags: [],
  updatedLabel: "Today",
  updatedISO: "2026-07-17T00:00:00.000Z",
  kind: "note",
};

let root: Root | null = null;

async function renderResults(bookmarked = false) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(
      createElement(LibraryDocumentResults, {
        rows: [DOCUMENT],
        progressMap: new Map(),
        bookmarkedHrefs: bookmarked ? new Set([DOCUMENT.href]) : new Set<string>(),
        emptyMessage: "No documents",
      })
    );
  });
  return host;
}

function bookmarkButton(host: HTMLElement): HTMLButtonElement {
  const button = host.querySelector<HTMLButtonElement>(`button[aria-label$=": ${DOCUMENT.title}"]`);
  if (!button) throw new Error("Bookmark button not found");
  return button;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  mocks.loadBookmarks.mockReset().mockReturnValue([]);
  mocks.toastError.mockReset();
  mocks.toggleBookmark.mockReset();
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  document.body.replaceChildren();
});

describe("LibraryDocumentResults bookmark persistence", () => {
  it("disables the row action and suppresses duplicate clicks while pending", async () => {
    const pending = deferred<unknown>();
    mocks.toggleBookmark.mockReturnValue(pending.promise);
    const host = await renderResults();
    const button = bookmarkButton(host);

    await act(async () => {
      button.click();
      button.click();
      await Promise.resolve();
    });

    expect(mocks.toggleBookmark).toHaveBeenCalledOnce();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      pending.resolve([]);
      await pending.promise;
    });

    expect(button.disabled).toBe(false);
  });

  it("keeps a true failure visible and reports it", async () => {
    mocks.toggleBookmark.mockRejectedValue(new Error("storage unavailable"));
    const host = await renderResults();

    await act(async () => {
      bookmarkButton(host).click();
      await Promise.resolve();
    });

    expect(mocks.toastError).toHaveBeenCalledWith("Bookmark was not updated", {
      description: "storage unavailable",
    });
  });

  it("does not report a duplicate error when the bookmark was already applied locally", async () => {
    mocks.toggleBookmark.mockRejectedValue(new Error("portable mirror unavailable"));
    mocks.loadBookmarks.mockReturnValue([{ href: DOCUMENT.href }]);
    const host = await renderResults();

    await act(async () => {
      bookmarkButton(host).click();
      await Promise.resolve();
    });

    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("also recovers a locally applied removal after mirror rejection", async () => {
    mocks.toggleBookmark.mockRejectedValue(new Error("portable mirror unavailable"));
    mocks.loadBookmarks.mockReturnValue([]);
    const host = await renderResults(true);

    await act(async () => {
      bookmarkButton(host).click();
      await Promise.resolve();
    });

    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
