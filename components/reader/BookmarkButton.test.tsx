// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Bookmark } from "@/lib/bookmarks";

const mocks = vi.hoisted(() => ({
  bookmarks: [] as Bookmark[],
  listeners: new Set<() => void>(),
  toastError: vi.fn(),
  toggleBookmark: vi.fn(),
}));

vi.mock("@/lib/bookmarks", () => ({
  isBookmarked: (href: string) => mocks.bookmarks.some((bookmark) => bookmark.href === href),
  loadBookmarks: () => mocks.bookmarks,
  subscribeBookmarks: (callback: () => void) => {
    mocks.listeners.add(callback);
    return () => mocks.listeners.delete(callback);
  },
  toggleBookmark: mocks.toggleBookmark,
}));

vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

import { BookmarkButton } from "@/components/reader/BookmarkButton";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const HREF = "/read/reader-notes";
const SAVED_BOOKMARK: Bookmark = {
  href: HREF,
  title: "Reader notes",
  kind: "document",
  addedAt: "2026-07-17T00:00:00.000Z",
};

function notifyBookmarksChanged() {
  for (const listener of mocks.listeners) listener();
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

let root: Root | null = null;

async function renderButton(): Promise<{ host: HTMLDivElement; button: HTMLButtonElement }> {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root?.render(createElement(BookmarkButton, { href: HREF, title: "Reader notes" }))
  );
  const button = host.querySelector<HTMLButtonElement>("button");
  expect(button).not.toBeNull();
  return { host, button: button! };
}

beforeEach(() => {
  mocks.bookmarks = [];
  mocks.listeners.clear();
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

describe("BookmarkButton persistence failures", () => {
  it("keeps the original state, disables duplicate clicks, and toasts when add was not applied", async () => {
    const pending = deferred<never>();
    mocks.toggleBookmark.mockReturnValue(pending.promise);
    const { button } = await renderButton();

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    button.click();
    expect(mocks.toggleBookmark).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.reject(new Error("storage unavailable"));
      await Promise.resolve();
    });

    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain("Bookmark");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't bookmark this document",
      expect.objectContaining({ description: expect.stringContaining("not bookmarked") })
    );
  });

  it("keeps an existing bookmark and reports a remove that was not applied locally", async () => {
    mocks.bookmarks = [SAVED_BOOKMARK];
    mocks.toggleBookmark.mockRejectedValue(new Error("storage unavailable"));
    const { button } = await renderButton();

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(button.textContent).toContain("Bookmarked");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't remove bookmark",
      expect.objectContaining({ description: expect.stringContaining("still saved") })
    );
  });

  it("accepts a mirror-only rejected add from local state without another toast", async () => {
    mocks.toggleBookmark.mockImplementation(async (bookmark: Bookmark) => {
      mocks.bookmarks = [bookmark];
      notifyBookmarksChanged();
      throw new Error("desktop mirror failed");
    });
    const { button } = await renderButton();

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(button.textContent).toContain("Bookmarked");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("accepts a mirror-only rejected remove from local state without another toast", async () => {
    mocks.bookmarks = [SAVED_BOOKMARK];
    mocks.toggleBookmark.mockImplementation(async () => {
      mocks.bookmarks = [];
      notifyBookmarksChanged();
      throw new Error("desktop mirror failed");
    });
    const { button } = await renderButton();

    await act(async () => {
      button.click();
      await Promise.resolve();
    });

    expect(button.textContent).toContain("Bookmark");
    expect(button.textContent).not.toContain("Bookmarked");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
