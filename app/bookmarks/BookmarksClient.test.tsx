// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  bookmarks: [
    {
      href: "/read/persisted",
      title: "Persisted bookmark",
      kind: "document" as const,
      addedAt: "2026-07-17T00:00:00.000Z",
    },
  ],
  removeBookmark: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/bookmarks", () => ({
  formatBookmarkAge: () => "Today",
  loadBookmarks: () => state.bookmarks,
  removeBookmark: state.removeBookmark,
  subscribeBookmarks: () => () => undefined,
}));

vi.mock("sonner", () => ({ toast: { error: state.toastError } }));

import BookmarksClient from "./BookmarksClient";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe("BookmarksClient", () => {
  beforeEach(() => {
    state.removeBookmark.mockReset().mockRejectedValue(new Error("quota exceeded"));
    state.toastError.mockReset();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("only exposes bookmark categories users can currently create", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(createElement(BookmarksClient)));

    const tabs = Array.from(host.querySelectorAll<HTMLElement>('[role="tab"]'));
    expect(tabs).toHaveLength(2);
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      expect.stringContaining("All"),
      expect.stringContaining("Documents"),
    ]);
    expect(host.textContent).not.toContain("Notes");

    act(() => root.unmount());
  });

  it("keeps the bookmark visible and explains that it was not removed", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(createElement(BookmarksClient)));

    const remove = host.querySelector<HTMLButtonElement>(
      '[aria-label="Remove bookmark: Persisted bookmark"]'
    );
    await act(async () => {
      remove?.click();
      await Promise.resolve();
    });

    expect(state.removeBookmark).toHaveBeenCalledWith("/read/persisted");
    expect(host.textContent).toContain("Persisted bookmark");
    expect(state.toastError).toHaveBeenCalledWith("Couldn't remove bookmark", {
      description:
        "“Persisted bookmark” is still saved. Check that local storage is available, then retry.",
    });

    act(() => root.unmount());
  });

  it("disables removal and ignores duplicate clicks while the request is pending", async () => {
    const request = deferred<void>();
    state.removeBookmark.mockReset().mockReturnValue(request.promise);

    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(createElement(BookmarksClient)));

    const remove = host.querySelector<HTMLButtonElement>(
      '[aria-label="Remove bookmark: Persisted bookmark"]'
    );
    await act(async () => {
      remove?.click();
      remove?.click();
    });

    expect(state.removeBookmark).toHaveBeenCalledTimes(1);
    expect(remove?.disabled).toBe(true);
    expect(remove?.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      request.resolve(undefined);
      await request.promise;
    });

    expect(remove?.disabled).toBe(false);
    expect(remove?.getAttribute("aria-busy")).toBe("false");
    act(() => root.unmount());
  });
});
