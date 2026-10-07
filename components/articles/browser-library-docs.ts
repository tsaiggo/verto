import type { ContentFileNode } from "@/lib/content-source";
import {
  articleBody,
  articleFormat,
  articleTitle,
  articleDisplayTitle,
  articleDescription,
  browserArticleHref,
  type BrowserArticle,
} from "@/lib/browser-articles";
import type { LibraryDoc } from "@/components/library/LibraryBrowser";
import { isTauri } from "@/lib/tauri";

export const BROWSER_LIBRARY_SECTION = "Browser library";
export const articleLibrarySection = () =>
  isTauri() ? "Desktop library" : BROWSER_LIBRARY_SECTION;

export function browserArticleToLibraryDoc(article: BrowserArticle): LibraryDoc {
  return {
    title: articleDisplayTitle(article),
    description: articleDescription(article.source),
    ext: `.${articleFormat(article.filename)}`,
    href: browserArticleHref(article.id),
    section: articleLibrarySection(),
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
    title: articleDisplayTitle(article),
    ext: `.${articleFormat(article.filename)}`,
    mtime: Date.parse(article.updatedAt),
    updated: article.updatedAt,
    draft: article.status === "draft",
  };
}

/** Only drop the opening H1 when the masthead already displays that title. */
export function browserArticleReadingBody(
  article: Pick<BrowserArticle, "source" | "filename">
): string {
  const body = articleBody(article.source);
  const leadingHeading = body.match(/^\s*#\s+(.+?)\s*#*\s*(?:\r?\n|$)/);
  if (!leadingHeading) return body;
  const title = articleTitle(article.source, article.filename);
  const openingLine = body.match(/^\s*#[ \t]+([^\r\n]+)(?:\r?\n|$)/);
  const anchorPrefix = openingLine?.[1].match(
    /^((?:<span id="epub-[\p{L}\p{N}-]+" \/>[ \t]*)+)(.*)$/u
  );
  const header = article.source.slice(0, article.source.length - body.length);
  const convertedBook = anchorPrefix || /^vertoBookId:[ \t]*"[0-9a-f-]+"[ \t]*$/im.test(header);
  if (!convertedBook) {
    return leadingHeading[1].trim() === title
      ? body.slice(leadingHeading[0].length).replace(/^\s*\r?\n/, "")
      : body;
  }
  if (!openingLine) return body;
  const heading = bookHeadingText(
    (anchorPrefix?.[2] ?? openingLine[1]).replace(/[ \t]+#+[ \t]*$/, "")
  );
  if (heading !== title) return body;
  const remainder = body.slice(openingLine[0].length).replace(/^\s*\r?\n/, "");
  return anchorPrefix ? `${anchorPrefix[1].trim()}\n\n${remainder}` : remainder;
}

/** Decode only literal escapes emitted by the EPUB serializer, never inline markup. */
function bookHeadingText(heading: string): string {
  return heading
    .replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/g, "$1")
    .replace(
      /&#(?:x([0-9a-f]+)|(\d+));|&(amp|lt|gt|quot|apos);/gi,
      (reference, hex, decimal, name) => {
        if (name)
          return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[
            name.toLowerCase()
          ];
        const point = Number.parseInt(hex ?? decimal, hex ? 16 : 10);
        return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
          ? String.fromCodePoint(point)
          : reference;
      }
    )
    .trim();
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
