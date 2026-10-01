import { describe, expect, it } from "vitest";
import type { BrowserArticle } from "@/lib/browser-articles";
import type { LibraryDoc } from "@/components/library/LibraryBrowser";
import {
  browserArticleReadingBody,
  browserArticleToContentNode,
  browserArticleToLibraryDoc,
  mergeLibraryDocuments,
} from "./browser-library-docs";

const article: BrowserArticle = {
  id: "local-article",
  filename: "reading-notes.mdx",
  source:
    "---\ntitle: Reading notes\n---\n# Reading notes\n\nFirst paragraph.\n\n## Next steps\n\nKeep reading.",
  createdAt: "2026-10-02T01:00:00.000Z",
  updatedAt: "2026-10-02T02:00:00.000Z",
  revision: 1,
  status: "saved",
};

describe("browser article library and reading projection", () => {
  it("places saved MDX in Notes while drafts stay distinguishable", () => {
    expect(browserArticleToLibraryDoc(article)).toMatchObject({
      title: "Reading notes",
      ext: ".mdx",
      href: "/read/local?document=local-article",
      section: "Browser library",
      kind: "note",
    });
    expect(browserArticleToLibraryDoc({ ...article, status: "draft" }).kind).toBe("draft");
  });

  it("merges and sorts browser articles without changing existing source classification", () => {
    const bundled: LibraryDoc = {
      title: "Included document",
      ext: ".md",
      href: "/read/included",
      section: "Workspace",
      tags: [],
      updatedISO: "2026-10-01T02:00:00.000Z",
      updatedLabel: "Yesterday",
      kind: "doc",
    };
    const merged = mergeLibraryDocuments([bundled], [article]);
    expect(merged.map((document) => document.href)).toEqual([
      "/read/local?document=local-article",
      "/read/included",
    ]);
    expect(merged[1]).toBe(bundled);
    expect(merged[1].kind).toBe("doc");
  });

  it("uses stable identity across filename and title edits for progress and annotations", () => {
    const file = browserArticleToContentNode(article);
    const renamed = browserArticleToContentNode({
      ...article,
      filename: "new-name.md",
      source: "# New title",
    });
    expect(file.slug).toEqual(["browser", "local-article"]);
    expect(renamed.slug).toEqual(file.slug);
    expect(renamed.href).toBe(file.href);
    expect(renamed.title).toBe("New title");
  });

  it("removes only a duplicate opening title from reading, preserving stored source", () => {
    const raw = article.source;
    expect(browserArticleReadingBody(article)).toBe(
      "First paragraph.\n\n## Next steps\n\nKeep reading."
    );
    expect(article.source).toBe(raw);
    const separateTitle = {
      ...article,
      source: "---\ntitle: Masthead title\n---\n# Separate body heading\n\nText",
    };
    expect(browserArticleReadingBody(separateTitle)).toContain("# Separate body heading");
    const insideCode = { ...article, source: "```md\n# Code example\n```\n\n# Real title" };
    expect(browserArticleReadingBody(insideCode)).toBe(insideCode.source);
  });
});
