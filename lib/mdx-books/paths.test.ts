import { describe, expect, it } from "vitest";
import { createBrowserArticle } from "@/lib/browser-articles";
import { bookIdInSource, bookPageLinks, portableBookPath, resolveBookHref } from "./paths";
import type { MdxBookSnapshot } from "./types";

describe("book runtime path resolution", () => {
  it("detects book metadata only in the opening frontmatter, including portable BOM/CRLF files", () => {
    expect(bookIdInSource('\uFEFF---\r\nvertoBookId: "book-123"\r\n---\r\n# Chapter')).toBe(
      "book-123"
    );
    expect(bookIdInSource("---\nvertoBookId: 'book-456'\n---\n# Chapter")).toBe("book-456");
    expect(bookIdInSource("# Ordinary article\n\n```yaml\nvertoBookId: example\n```")).toBeNull();
    expect(bookIdInSource("---\ntitle: Normal\n---\nvertoBookId: body-example")).toBeNull();
    expect(bookIdInSource("---\nvertoBookId: unfinished")).toBeNull();
  });
  it("decodes portable filenames while retaining a chapter anchor", () => {
    expect(portableBookPath("./Chapter%20one.mdx?view=1#epub-anchor")).toEqual({
      path: "Chapter one.mdx",
      fragment: "#epub-anchor",
    });
    expect(portableBookPath("index.mdx")).toEqual({ path: "index.mdx", fragment: "" });
  });
  it("rejects traversal, filesystem paths, schemes and malformed URL encoding", () => {
    for (const path of [
      "../escape.png",
      "assets/%2e%2e/escape.png",
      "assets\\cover.png",
      "assets/%00.png",
      "/etc/passwd",
      "//host/image",
      "https://host/image",
      "file:///C:/x",
      "blob:external",
      "%GG",
    ])
      expect(portableBookPath(path)).toBeNull();
  });
  it("maps original chapter names after renaming, adds new pages, and never redirects a deleted chapter to a colliding new filename", () => {
    const snapshot: MdxBookSnapshot = {
      book: {
        id: "book",
        rootArticleId: "root",
        sourceDocumentId: "epub",
        title: "Book",
        createdAt: "now",
        chapterFiles: [
          { articleId: "one", filename: "001-one.mdx", originalPath: "one.xhtml" },
          { articleId: "deleted", filename: "002-deleted.mdx", originalPath: "deleted.xhtml" },
        ],
        toc: [],
      },
      articles: [
        { ...createBrowserArticle({ filename: "renamed-home.mdx", source: "# Home" }), id: "root" },
        { ...createBrowserArticle({ filename: "new-name.mdx", source: "# One" }), id: "one" },
        { ...createBrowserArticle({ filename: "notes.mdx", source: "# Notes" }), id: "notes" },
        {
          ...createBrowserArticle({ filename: "002-deleted.mdx", source: "# Collision" }),
          id: "collision",
        },
      ],
      assets: [],
    };
    const pages = bookPageLinks(snapshot);
    expect(resolveBookHref("./index.mdx", pages)).toBe("/read/local?document=root");
    expect(resolveBookHref("./001-one.mdx#epub-intro", pages)).toBe(
      "/read/local?document=one#epub-intro"
    );
    expect(resolveBookHref("./new-name.mdx", pages)).toBe("/read/local?document=one");
    expect(resolveBookHref("./notes.mdx", pages)).toBe("/read/local?document=notes");
    expect(resolveBookHref("./002-deleted.mdx", pages)).toBeUndefined();
  });
  it("retains external and same-page links for the existing sanitizer, while missing chapter links remain inert", () => {
    const pages = new Map<string, string>();
    expect(resolveBookHref("#footnote", pages)).toBe("#footnote");
    expect(resolveBookHref("mailto:writer@example.com", pages)).toBe("mailto:writer@example.com");
    expect(resolveBookHref("https://example.com", pages)).toBe("https://example.com");
    expect(resolveBookHref("javascript:bad()", pages)).toBe("javascript:bad()");
    expect(resolveBookHref("./missing.md", pages)).toBeUndefined();
    expect(resolveBookHref("./readme.txt", pages)).toBe("./readme.txt");
  });
  it("does not invent routes to a deleted book root", () => {
    const snapshot: MdxBookSnapshot = {
      book: {
        id: "book",
        rootArticleId: "missing",
        sourceDocumentId: "epub",
        title: "Book",
        createdAt: "now",
        chapterFiles: [],
        toc: [],
      },
      articles: [],
      assets: [],
    };
    expect(bookPageLinks(snapshot).size).toBe(0);
  });
});
