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
  it("uses the renamed page title in projections while keeping source and filename unchanged", () => {
    const renamed = { ...article, title: "Project notebook" };
    expect(browserArticleToLibraryDoc(renamed).title).toBe("Project notebook");
    expect(browserArticleToContentNode(renamed).title).toBe("Project notebook");
    expect(browserArticleReadingBody(renamed)).toBe(browserArticleReadingBody(article));
    expect(renamed.source).toBe(article.source);
    expect(renamed.filename).toBe(article.filename);
  });
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

  it("keeps generated EPUB anchors after hiding a matching chapter heading", () => {
    const chapter = {
      ...article,
      source:
        '---\ntitle: "First chapter"\nvertoBookId: "11111111-1111-4111-8111-111111111111"\n---\n\n# <span id="epub-001-intro" /> First chapter\n\nThe chapter body.',
    };
    const stored = chapter.source;
    expect(browserArticleReadingBody(chapter)).toBe(
      '<span id="epub-001-intro" />\n\nThe chapter body.'
    );
    expect(chapter.source).toBe(stored);
    const different = {
      ...chapter,
      source: chapter.source.replace('title: "First chapter"', 'title: "Another chapter"'),
    };
    expect(browserArticleReadingBody(different)).toBe(articleBodyForTest(different.source));
  });

  it("compares converted literal escapes without interpreting arbitrary heading markup", () => {
    const title = "import {value} & <Plain> #";
    const chapter = {
      ...article,
      source: `---\ntitle: ${JSON.stringify(title)}\n---\n# <span id="epub-002-heading" /> &#x69;mport \\{value\\} &amp; &lt;Plain&gt; \\#\n\nText`,
    };
    expect(browserArticleReadingBody(chapter)).toBe('<span id="epub-002-heading" />\n\nText');
    const bookRoot = {
      ...chapter,
      source: `---\ntitle: ${JSON.stringify(title)}\nvertoBookId: "11111111-1111-4111-8111-111111111111"\n---\n# import \\{value\\} & <Plain> \\#\n\nContents`,
    };
    expect(browserArticleReadingBody(bookRoot)).toBe("Contents");
    const ordinary = {
      ...article,
      source: "---\ntitle: Literal {value}\n---\n# Literal \\{value\\}\n\nText",
    };
    expect(browserArticleReadingBody(ordinary)).toBe(articleBodyForTest(ordinary.source));
    const richHeading = {
      ...chapter,
      source:
        '---\ntitle: "First chapter"\n---\n# <span id="epub-001-intro" /> _First chapter_\n\nText',
    };
    expect(browserArticleReadingBody(richHeading)).toBe(articleBodyForTest(richHeading.source));
  });
});

function articleBodyForTest(source: string): string {
  return source.slice(source.indexOf("\n---\n") + "\n---\n".length);
}
