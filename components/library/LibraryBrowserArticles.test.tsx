// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserArticle } from "@/lib/browser-articles";

const mocks = vi.hoisted(() => ({
  search: "",
  articles: [] as BrowserArticle[],
  status: "ready" as "ready" | "loading" | "error",
  error: null as string | null,
  retry: vi.fn(),
  runtime: { status: "idle", folder: null, index: null, error: null },
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mocks.search) }));
vi.mock("@/lib/tauri", async (original) => ({
  ...(await original<typeof import("@/lib/tauri")>()),
  isTauri: () => false,
}));
vi.mock("@/components/runtime/useRuntimeLocalIndex", () => ({
  useRuntimeLocalIndex: () => mocks.runtime,
}));
vi.mock("@/components/articles/useBrowserArticles", () => ({
  useBrowserArticles: () => ({
    articles: mocks.articles,
    status: mocks.status,
    error: mocks.error,
    retry: mocks.retry,
  }),
}));
vi.mock("@/components/documents/useImportedDocuments", () => ({
  useImportedDocuments: () => ({ documents: [], status: "ready", error: null, retry: vi.fn() }),
}));
vi.mock("@/lib/reading-state", () => ({ loadReadingState: () => ({ recent: [] }) }));
vi.mock("@/lib/bookmarks", () => ({
  loadBookmarks: () => [],
  subscribeBookmarks: () => () => {},
  toggleBookmark: vi.fn(),
}));

import LibraryBrowser from "./LibraryBrowser";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });

const article: BrowserArticle = {
  id: "browser-note",
  filename: "notes.mdx",
  source: "# A saved browser article\n\nMy article body.",
  status: "saved",
  revision: 1,
  createdAt: "2026-10-02T01:00:00.000Z",
  updatedAt: "2026-10-02T02:00:00.000Z",
};
let root: Root | null = null;
let host: HTMLDivElement;

async function renderLibrary() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root?.render(createElement(LibraryBrowser, { docs: [], bundledSectionCount: 0 }))
  );
}
beforeEach(() => {
  mocks.search = "";
  mocks.articles = [article];
  mocks.status = "ready";
  mocks.error = null;
  mocks.retry.mockReset();
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
});

describe("Library browser article integration", () => {
  it("shows saved MDX notes with native reader links and an explicit browser source", async () => {
    mocks.search = "view=notes";
    await renderLibrary();
    expect(
      host.querySelector("a[href='/read/local?document=browser-note']")?.textContent
    ).toContain("A saved browser article");
    expect(host.querySelector("[aria-label='Browser library source']")?.textContent).toContain(
      "1 article saved on this browser"
    );
    expect(host.querySelector("a[href='/editor']")?.textContent).toContain("New note");
  });

  it("excludes browser drafts from Notes and shows them in Drafts", async () => {
    mocks.articles = [{ ...article, status: "draft" }];
    mocks.search = "view=notes";
    await renderLibrary();
    expect(host.querySelector("a[href='/read/local?document=browser-note']")).toBeNull();
    expect(host.textContent).toContain("No notes yet");
    mocks.search = "view=drafts";
    await act(async () =>
      root?.render(createElement(LibraryBrowser, { docs: [], bundledSectionCount: 0 }))
    );
    expect(host.querySelector("a[href='/read/local?document=browser-note']")).not.toBeNull();
  });

  it("offers storage recovery without claiming an empty browser library", async () => {
    mocks.articles = [];
    mocks.status = "error";
    mocks.error = "Browser storage is unavailable";
    await renderLibrary();
    expect(host.querySelector("[role='alert']")?.textContent).toContain(
      "Browser articles couldn’t be read"
    );
    expect(host.textContent).not.toContain("0 articles saved");
    expect(host.textContent).not.toContain("ready for its first document");
    const retry = Array.from(host.querySelectorAll("button")).find(
      (button) => button.textContent === "Retry"
    );
    act(() => retry?.click());
    expect(mocks.retry).toHaveBeenCalledOnce();
  });

  it("preserves the loading state while the browser article store is opening", async () => {
    mocks.articles = [];
    mocks.status = "loading";
    await renderLibrary();
    expect(host.querySelector("[aria-label='Loading documents']")).not.toBeNull();
    expect(host.textContent).toContain("Opening articles saved in this browser");
    expect(host.textContent).not.toContain("0 articles saved");
  });
});
