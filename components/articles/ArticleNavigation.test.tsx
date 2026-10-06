// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserArticle } from "@/lib/browser-articles";
import type { MdxBookRecord } from "@/lib/mdx-books/types";
import type { BrowserArticlesState } from "./useBrowserArticles";

const mocks = vi.hoisted(() => ({
  local: {} as BrowserArticlesState,
  findBook: vi.fn(),
  readSnapshot: vi.fn(),
  retry: vi.fn(),
  isTauri: vi.fn(() => false),
}));
vi.mock("@/lib/tauri", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tauri")>()),
  isTauri: mocks.isTauri,
}));
vi.mock("./useBrowserArticles", () => ({ useBrowserArticles: () => mocks.local }));
vi.mock("@/lib/mdx-books/storage", () => ({
  findMdxBookForArticle: mocks.findBook,
  readMdxBookSnapshot: mocks.readSnapshot,
}));

import ArticleNavigation from "./ArticleNavigation";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });

function page(id: string, title: string, fields: Partial<BrowserArticle> = {}): BrowserArticle {
  return {
    id,
    filename: `${id}.mdx`,
    source: `# ${title}\n\nA careful observation from the field.`,
    title,
    createdAt: "2026-10-02T01:00:00.000Z",
    updatedAt: "2026-10-02T02:00:00.000Z",
    revision: 1,
    status: "saved",
    ...fields,
  };
}

const book: MdxBookRecord = {
  id: "field-book",
  rootArticleId: "overview",
  sourceDocumentId: "original-epub",
  title: "Imported title",
  author: "A. Reader",
  createdAt: "2026-10-02T01:00:00.000Z",
  chapterFiles: [
    { articleId: "opening", filename: "001-opening.mdx", originalPath: "opening.xhtml" },
    { articleId: "later", filename: "002-later.mdx", originalPath: "later.xhtml" },
    { articleId: "supplement", filename: "003-supplement.mdx", originalPath: "supplement.xhtml" },
  ],
  toc: [
    {
      title: "Old opening title",
      articleId: "opening",
      anchor: "opening",
      children: [
        { title: "Field observations", articleId: "opening", anchor: "observations", children: [] },
        { title: "Old later title", articleId: "later", children: [] },
      ],
    },
  ],
};

let host: HTMLDivElement;
let root: Root;

async function render(props: Parameters<typeof ArticleNavigation>[0] = {}) {
  if (!root) {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  }
  await act(async () => root.render(createElement(ArticleNavigation, props)));
}

async function search(value: string) {
  const input = host.querySelector<HTMLInputElement>("input[type='search']")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function click(label: string) {
  return act(async () => {
    Array.from(host.querySelectorAll("button"))
      .find((button) => button.textContent === label)
      ?.click();
  });
}

beforeEach(() => {
  root = undefined as unknown as Root;
  mocks.local = {
    articles: [
      page("a", "Reading notes"),
      page("draft", "An unfinished thought", { status: "draft" }),
    ],
    status: "ready",
    error: null,
    retry: mocks.retry,
  };
  mocks.findBook.mockReset().mockResolvedValue(null);
  mocks.retry.mockReset();
  mocks.readSnapshot.mockReset();
  mocks.isTauri.mockReset().mockReturnValue(false);
});
afterEach(() => {
  if (root) act(() => root.unmount());
  document.body.replaceChildren();
});

describe("article document navigation", () => {
  it("shows real saved articles and drafts, with the current reading route and readable metadata", async () => {
    await render({ articleId: "a" });
    expect(host.querySelector("[aria-label='Document navigation']")).not.toBeNull();
    expect(host.querySelector("a[aria-current='page']")?.getAttribute("href")).toBe(
      "/read/local?document=a"
    );
    expect(host.textContent).toContain("Reading notes");
    expect(host.textContent).toContain("An unfinished thought");
    expect(host.textContent).toContain("A careful observation from the field.");
    expect(host.textContent).toContain("Local · MDX");
    expect(host.textContent).toContain("Draft");
    expect(host.textContent).toContain("Saved");
    expect(host.querySelector("a[aria-label='Create article']")?.getAttribute("href")).toBe(
      "/editor"
    );
    expect(mocks.readSnapshot).not.toHaveBeenCalled();
  });

  it("creates desktop articles in the managed library instead of the source folder", async () => {
    mocks.isTauri.mockReturnValue(true);
    await render({ articleId: "a", mode: "edit" });
    expect(host.querySelector("a[aria-label='Create article']")?.getAttribute("href")).toBe(
      "/editor?managed=1"
    );
  });

  it("searches real title and preview text without replacing the current document", async () => {
    await render({ articleId: "a" });
    await search("unfinished");
    expect(host.querySelector("nav[aria-label='Local articles']")?.textContent).toContain(
      "An unfinished thought"
    );
    expect(host.querySelector("nav[aria-label='Local articles']")?.textContent).not.toContain(
      "Reading notes"
    );
    await search("careful observation");
    expect(host.querySelectorAll("nav[aria-label='Local articles'] li")).toHaveLength(2);
    await search("absent");
    expect(host.textContent).toContain("No documents match this search.");
    await search("");
    expect(host.querySelector("a[aria-current='page']")?.textContent).toContain("Reading notes");
  });

  it("uses connected-source entries, live routes and real tags without reading local book assets", async () => {
    const sourceDocuments = [
      {
        title: "Verto Feature Demo",
        href: "/read/demo",
        description: "A source document with reading examples.",
        section: "Overview",
        tags: ["guide"],
      },
      {
        title: "Working with a library",
        href: "/read/library",
        section: "Overview",
        tags: ["reference"],
      },
    ];
    await render({
      sourceDocuments,
      activeHref: "/read/demo",
      toc: createElement("nav", { "aria-label": "Table of Contents" }, "Introduction"),
    });
    expect(host.querySelector("a[aria-current='page']")?.getAttribute("href")).toBe("/read/demo");
    expect(host.textContent).toContain("A source document with reading examples.");
    expect(host.textContent).toContain("guide");
    expect(host.textContent).not.toContain("An unfinished thought");
    expect(host.querySelector("summary")?.textContent).toBe("On this page");
    expect(host.querySelector("[data-document-navigation-scroll]")).not.toBeNull();
    await search("reference");
    expect(host.querySelector("nav[aria-label='Source documents']")?.textContent).toContain(
      "Working with a library"
    );
    expect(host.querySelector("nav[aria-label='Source documents']")?.textContent).not.toContain(
      "Verto Feature Demo"
    );
    expect(mocks.findBook).not.toHaveBeenCalled();
    expect(mocks.readSnapshot).not.toHaveBeenCalled();
  });

  it("uses editor links for drafts and book sections, preserving native leave-guard interception", async () => {
    mocks.findBook.mockResolvedValue(book);
    mocks.local.articles = [
      page("overview", "Field book"),
      page("opening", "Opening chapter", { parentId: "overview" }),
    ];
    await render({ articleId: "opening", mode: "edit" });
    const links = Array.from(host.querySelectorAll("nav[aria-label='Book chapters'] a"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/editor?document=opening",
      "/editor?document=opening",
    ]);
    expect(host.querySelector("a[aria-current='page']")?.textContent).toContain("Opening chapter");
  });

  it("keeps EPUB ordering and subsection anchors while renamed, deleted and added pages follow live data", async () => {
    mocks.findBook.mockResolvedValue(book);
    mocks.local.articles = [
      page("overview", "My renamed field book"),
      page("opening", "New opening title", { parentId: "overview" }),
      page("later", "Later chapter", { parentId: "overview" }),
      page("supplement", "Appendix", { parentId: "overview" }),
      page("added", "New field note", { parentId: "overview", status: "draft" }),
      page("unrelated", "A separate article"),
    ];
    await render({ articleId: "opening" });
    expect(host.textContent).toContain("My renamed field book");
    const chapters = host.querySelector("nav[aria-label='Book chapters']")!;
    expect(chapters.textContent).toContain("New opening title");
    expect(chapters.textContent).toContain("Field observations");
    expect(chapters.textContent).toContain("New field note");
    expect(chapters.textContent).toContain("Appendix");
    expect(chapters.textContent).not.toContain("A separate article");
    expect(
      chapters.querySelector("a[href='/read/local?document=opening#observations']")
    ).not.toBeNull();
    expect(chapters.querySelectorAll("a[aria-current='page']")).toHaveLength(1);
    expect(chapters.querySelector("ol ol")).not.toBeNull();
    expect(Array.from(chapters.querySelectorAll("a")).map((link) => link.textContent)).toEqual([
      "New opening title",
      "Field observations",
      "Later chapter",
      "Appendix",
      "New field noteDraft",
    ]);
    mocks.local = {
      ...mocks.local,
      articles: mocks.local.articles
        .filter((article) => article.id !== "later")
        .map((article) =>
          article.id === "opening"
            ? { ...article, title: "Opening renamed again", revision: 2 }
            : article
        ),
    };
    await render({ articleId: "opening" });
    expect(host.textContent).toContain("Opening renamed again");
    expect(host.textContent).not.toContain("Later chapter");
    expect(host.textContent).not.toContain("Old later title");
    expect(book.toc[0].title).toBe("Old opening title");
    expect(mocks.readSnapshot).not.toHaveBeenCalled();
    await search("observations");
    expect(host.querySelector("nav[aria-label='Book chapters']")?.textContent).toContain(
      "Field observations"
    );
    expect(host.querySelector("nav[aria-label='Book chapters']")?.textContent).not.toContain(
      "Appendix"
    );
  });

  it("retains known chapter links on lookup failure and retries metadata without loading assets", async () => {
    mocks.findBook.mockResolvedValue(book);
    mocks.local.articles = [
      page("overview", "Field book"),
      page("opening", "Opening chapter", { parentId: "overview" }),
    ];
    await render({ articleId: "opening" });
    mocks.findBook.mockRejectedValue(new Error("Device storage unavailable"));
    mocks.local = { ...mocks.local, articles: [...mocks.local.articles] };
    await render({ articleId: "opening" });
    expect(host.querySelector("[role='alert']")?.textContent).toContain(
      "Book navigation couldn’t be checked"
    );
    expect(host.querySelector("a[aria-current='page']")?.textContent).toContain("Opening chapter");
    mocks.findBook.mockResolvedValue(book);
    await click("Retry book navigation");
    expect(host.querySelector("[role='alert']")).toBeNull();
    expect(mocks.readSnapshot).not.toHaveBeenCalled();
  });

  it("distinguishes loading, storage failure and an empty library with a working retry", async () => {
    mocks.local = { ...mocks.local, articles: [], status: "loading" };
    await render();
    expect(host.querySelector("[role='status']")?.textContent).toBe("Loading documents…");
    mocks.local = { ...mocks.local, status: "error", error: "Permission denied" };
    await render();
    expect(host.textContent).toContain("Documents couldn’t load. Permission denied");
    expect(host.textContent).not.toContain("Your saved articles and drafts will appear here");
    await click("Retry documents");
    expect(mocks.retry).toHaveBeenCalledOnce();
    mocks.local = { ...mocks.local, status: "ready", error: null };
    await render();
    expect(host.textContent).toContain("Your saved articles and drafts will appear here.");
  });

  it("does not describe EPUB chapters as deleted when the article store is unavailable", async () => {
    mocks.findBook.mockResolvedValue(book);
    mocks.local = {
      ...mocks.local,
      articles: [],
      status: "error",
      error: "Article storage unavailable",
    };
    await render({ articleId: "opening" });
    expect(host.textContent).toContain("Documents couldn’t load");
    expect(host.textContent).not.toContain("The book overview was removed");
    expect(host.textContent).not.toContain("No chapters remain");
  });

  it("ignores a stale book lookup when the selected article changes", async () => {
    let completeOld: (value: MdxBookRecord | null) => void = () => {};
    mocks.findBook
      .mockImplementationOnce(
        () =>
          new Promise<MdxBookRecord | null>((resolve) => {
            completeOld = resolve;
          })
      )
      .mockResolvedValue(null);
    await render({ articleId: "opening" });
    await render({ articleId: "a" });
    await act(async () => completeOld(book));
    expect(host.querySelector("h2")?.textContent).toBe("Documents");
    expect(host.querySelector("a[aria-current='page']")?.textContent).toContain("Reading notes");
  });
});
