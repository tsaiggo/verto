import type { ContentFileNode } from "@/lib/content-source";
import {
  articleBody,
  articleFormat,
  articleTitle,
  browserArticleHref,
  type BrowserArticle,
} from "@/lib/browser-articles";
import type { LibraryDoc } from "@/components/library/LibraryBrowser";

export const BROWSER_LIBRARY_SECTION = "Browser library";

export function browserArticleToLibraryDoc(article: BrowserArticle): LibraryDoc {
  return {
    title: articleTitle(article.source, article.filename),
    ext: `.${articleFormat(article.filename)}`,
    href: browserArticleHref(article.id),
    section: BROWSER_LIBRARY_SECTION,
    tags: [],
    updatedISO: article.updatedAt,
    updatedLabel: new Date(article.updatedAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    // Both Markdown and MDX documents written here belong to Notes. Existing
    // connected-source classification stays independent of this local store.
    kind: article.status === "draft" ? "draft" : "note",
  };
}

export function browserArticleToContentNode(article: BrowserArticle): ContentFileNode {
  return {
    type: "file",
    id: article.id,
    slug: ["browser", article.id],
    href: browserArticleHref(article.id),
    title: articleTitle(article.source, article.filename),
    ext: `.${articleFormat(article.filename)}`,
    mtime: Date.parse(article.updatedAt),
    updated: article.updatedAt,
    draft: article.status === "draft",
  };
}

/** Only drop the opening H1 when the masthead already displays that title. */
export function browserArticleReadingBody(article: BrowserArticle): string {
  const body = articleBody(article.source);
  const leadingHeading = body.match(/^\s*#\s+(.+?)\s*#*\s*(?:\r?\n|$)/);
  if (
    !leadingHeading ||
    leadingHeading[1].trim() !== articleTitle(article.source, article.filename)
  ) {
    return body;
  }
  return body.slice(leadingHeading[0].length).replace(/^\s*\r?\n/, "");
}

export function mergeLibraryDocuments(
  sourceDocs: LibraryDoc[],
  browserArticles: BrowserArticle[]
): LibraryDoc[] {
  return [...sourceDocs, ...browserArticles.map(browserArticleToLibraryDoc)].sort(
    (left, right) =>
      Date.parse(right.updatedISO) - Date.parse(left.updatedISO) ||
      left.title.localeCompare(right.title)
  );
}
