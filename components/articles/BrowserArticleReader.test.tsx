// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserArticle } from "@/lib/browser-articles";

const mocks = vi.hoisted(() => ({
  id: "article-a",
  read: vi.fn(),
  listener: null as (() => void) | null,
  unsubscribe: vi.fn(),
  renderFailure: false,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams({ document: mocks.id }),
}));
vi.mock("@/lib/browser-articles", async (original) => ({
  ...(await original<typeof import("@/lib/browser-articles")>()),
  readBrowserArticle: mocks.read,
  subscribeBrowserArticles: (listener: () => void) => {
    mocks.listener = listener;
    return mocks.unsubscribe;
  },
}));
vi.mock("@/components/reader/ReaderWorkspace", () => ({
  default: ({
    children,
    masthead,
    doc,
  }: {
    children: ReactNode;
    masthead: ReactNode;
    doc?: { href: string };
  }) => createElement("section", { "data-source-href": doc?.href }, masthead, children),
}));
vi.mock("@/components/reader/DocMasthead", () => ({
  DocMasthead: ({ file, editHref }: { file: { title: string }; editHref: string }) =>
    createElement(
      "header",
      null,
      createElement("h1", null, file.title),
      createElement("a", { href: editHref }, "Edit")
    ),
}));
vi.mock("@/components/layout/TableOfContents", () => ({ default: () => null }));
vi.mock("@/components/reader/ReadingStateTracker", () => ({
  default: ({ href, slug }: { href: string; slug: string[] }) =>
    createElement("span", { "data-reading-href": href, "data-reading-slug": slug.join("/") }),
}));
vi.mock("@/components/reader/AnnotationsLayer", () => ({
  default: ({ docSlug }: { docSlug: string }) =>
    createElement("span", { "data-annotations-slug": docSlug }),
}));
vi.mock("@/components/mdx/InlineCommentProvider", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/runtime/RuntimeDocument", () => ({
  RuntimeDocument: ({ source }: { source: string }) => {
    if (mocks.renderFailure) throw new Error("Invalid MDX syntax");
    return createElement("p", { "data-rendered-source": true }, source);
  },
}));

import BrowserArticleReader from "./BrowserArticleReader";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });

const saved: BrowserArticle = {
  id: "article-a",
  filename: "first.mdx",
  source: "# First article\n\nSaved original body.",
  createdAt: "2026-10-02T01:00:00.000Z",
  updatedAt: "2026-10-02T02:00:00.000Z",
  revision: 1,
  status: "saved",
};

let root: Root | null = null;
let host: HTMLDivElement;

async function renderReader() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(createElement(BrowserArticleReader));
  });
}

async function notify() {
  await act(async () => {
    mocks.listener?.();
  });
}

function button(label: string) {
  return Array.from(host.querySelectorAll("button")).find(
    (element) => element.textContent === label
  );
}

beforeEach(() => {
  mocks.id = "article-a";
  mocks.read.mockReset().mockResolvedValue(saved);
  mocks.unsubscribe.mockReset();
  mocks.listener = null;
  mocks.renderFailure = false;
});
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("browser article reader", () => {
  it("reads stored full source with stable reading, annotation, Agent and edit identities", async () => {
    await renderReader();
    expect(mocks.read).toHaveBeenCalledWith("article-a");
    expect(host.querySelector("h1")?.textContent).toBe("First article");
    expect(host.querySelector("[data-rendered-source]")?.textContent).toBe("Saved original body.");
    expect(host.querySelector('a[href="/editor?document=article-a"]')?.textContent).toBe("Edit");
    expect(host.querySelector("[data-reading-slug]")?.getAttribute("data-reading-slug")).toBe(
      "browser/article-a"
    );
    expect(
      host.querySelector("[data-annotations-slug]")?.getAttribute("data-annotations-slug")
    ).toBe("browser/article-a");
    expect(host.querySelector("[data-source-href]")?.getAttribute("data-source-href")).toBe(
      "/read/local?document=article-a"
    );
  });

  it("preserves current body during a cross-window update until Reload latest", async () => {
    await renderReader();
    mocks.read.mockResolvedValue({
      ...saved,
      revision: 2,
      source: "# Changed title\n\nNew saved body.",
    });
    await notify();
    expect(host.textContent).toContain("A newer version was saved in another window");
    expect(host.textContent).toContain("Saved original body.");
    expect(host.textContent).not.toContain("New saved body.");
    await act(async () => button("Reload latest")?.click());
    expect(host.querySelector("h1")?.textContent).toBe("Changed title");
    expect(host.textContent).toContain("New saved body.");
    expect(host.textContent).not.toContain("Saved original body.");
    expect(
      host.querySelector("[data-annotations-slug]")?.getAttribute("data-annotations-slug")
    ).toBe("browser/article-a");
  });

  it("retains the opened source and offers retry after storage fails", async () => {
    await renderReader();
    mocks.read.mockRejectedValue(new Error("Storage unavailable"));
    await notify();
    expect(host.querySelector("[role='alert']")?.textContent).toContain(
      "New saved changes couldn’t be checked"
    );
    expect(host.textContent).toContain("Saved original body.");
    mocks.read.mockResolvedValue(saved);
    await act(async () => button("Retry")?.click());
    expect(host.querySelector("[role='alert']")).toBeNull();
    expect(host.textContent).toContain("Saved original body.");
  });

  it("distinguishes a missing article from unavailable storage", async () => {
    mocks.read.mockResolvedValue(null);
    await renderReader();
    expect(host.textContent).toContain("This article isn’t in this browser");
    expect(host.querySelector("[data-rendered-source]")).toBeNull();
    expect(host.querySelector("a[href='/library']")).not.toBeNull();
  });

  it("stops showing a removed article when storage changes", async () => {
    await renderReader();
    mocks.read.mockResolvedValue(null);
    await notify();
    expect(host.textContent).toContain("This article isn’t in this browser");
    expect(host.textContent).not.toContain("Saved original body.");
  });

  it("recovers an initial storage failure without claiming the library is empty", async () => {
    mocks.read.mockRejectedValue(new Error("Storage unavailable"));
    await renderReader();
    expect(host.textContent).toContain("Your article couldn’t be opened");
    expect(host.textContent).not.toContain("isn’t in this browser");
    mocks.read.mockResolvedValue(saved);
    await act(async () => button("Try again")?.click());
    expect(host.textContent).toContain("Saved original body.");
  });

  it("offers source correction if MDX cannot render without losing the source", async () => {
    mocks.renderFailure = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await renderReader();
    expect(host.textContent).toContain("This document couldn’t be rendered");
    expect(host.textContent).toContain("The saved source is unchanged");
    expect(host.querySelector("a[href='/editor?document=article-a']")).not.toBeNull();
  });

  it("does not read arbitrary records when no document is selected", async () => {
    mocks.id = "";
    await renderReader();
    expect(host.textContent).toContain("Choose an article to read");
    expect(mocks.read).not.toHaveBeenCalled();
  });
});
