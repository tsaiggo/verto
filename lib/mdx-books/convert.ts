import type { BrowserArticle } from "@/lib/browser-articles";
import type { ImportedDocument } from "@/lib/imported-documents";
import {
  MAX_BOOK_ASSET_BYTES,
  MAX_BOOK_SOURCE_BYTES,
  type BookTocItem,
  type ConversionIssue,
  type MdxBookDraft,
  type MdxBookRecord,
} from "./types";
import { openConversionArchive, type ConversionChapter } from "./convert-archive";
import {
  assignAnchors,
  bookUuid,
  chapterToMdx,
  collectBookAssets,
  safeSlug,
  validateBookMdx,
} from "./convert-html";
import { readBookToc } from "./convert-navigation";

function escapeText(value: string): string {
  return value.replace(/\s+/g, " ").replace(/[\\`*_[\]{}<>#]/g, "\\$&");
}
function metadata(title: string, book: MdxBookRecord, order?: number): string {
  return `---\ntitle: ${JSON.stringify(title)}\nbook: ${JSON.stringify(book.title)}\nvertoBookId: ${JSON.stringify(book.id)}\n${order !== undefined ? `order: ${order}\n` : ""}${book.author ? `author: ${JSON.stringify(book.author)}\n` : ""}${book.language ? `language: ${JSON.stringify(book.language)}\n` : ""}---\n\n`;
}
function tocMarkdown(toc: BookTocItem[], book: MdxBookRecord, level = 0): string {
  return toc
    .map((item) => {
      const file = book.chapterFiles.find((chapter) => chapter.articleId === item.articleId)!;
      const link = `./${file.filename}${item.anchor ? `#${item.anchor}` : ""}`;
      return `${"  ".repeat(level)}- [${escapeText(item.title)}](${link})\n${tocMarkdown(item.children, book, level + 1)}`;
    })
    .join("");
}
function page(
  id: string,
  filename: string,
  title: string,
  source: string,
  createdAt: string,
  parentId: string | null,
  order: number
): BrowserArticle {
  return {
    id,
    filename,
    title,
    source,
    createdAt,
    updatedAt: createdAt,
    revision: 0,
    status: "saved",
    parentId,
    order,
  };
}
function pageTitle(title: string, issues: ConversionIssue[]): string {
  if (title.length <= 500) return title;
  issues.push({
    code: "title-length",
    message:
      "A page title exceeds 500 characters. Its page name is shortened; the full heading remains in the editable content.",
  });
  return `${title.slice(0, 499)}…`;
}

/** Preview a complete portable book; persistence is a separate atomic, explicitly approved step. */
export async function convertEpubToMdx(
  bytes: ArrayBuffer,
  source: ImportedDocument
): Promise<MdxBookDraft> {
  if (source.format !== "epub")
    throw new Error("Only an EPUB can be converted to an editable MDX book.");
  const issues: ConversionIssue[] = [];
  const archive = await openConversionArchive(bytes, issues);
  const createdAt = new Date().toISOString();
  const id = bookUuid();
  const rootArticleId = bookUuid();
  const chapters: ConversionChapter[] = archive.chapters.map((chapter, index) => ({
    ...chapter,
    title: pageTitle(chapter.title, issues),
    articleId: bookUuid(),
    filename: `${String(index + 1).padStart(3, "0")}-${safeSlug(chapter.title)}.mdx`,
    anchors: new Map(),
  }));
  chapters.forEach((chapter, index) => assignAnchors(chapter, index, issues));
  const book: MdxBookRecord = {
    id,
    rootArticleId,
    sourceDocumentId: source.id,
    title: pageTitle(archive.title, issues),
    ...(archive.author ? { author: archive.author } : {}),
    ...(archive.language ? { language: archive.language } : {}),
    createdAt,
    chapterFiles: chapters.map((chapter) => ({
      articleId: chapter.articleId,
      filename: chapter.filename,
      originalPath: chapter.path,
    })),
    toc: [],
  };
  book.toc = await readBookToc(archive, chapters, issues);
  const { assets, paths } = await collectBookAssets(
    archive,
    chapters,
    id,
    issues,
    MAX_BOOK_ASSET_BYTES
  );
  const intro = `${metadata(book.title, book)}# ${escapeText(book.title)}\n\n${book.author ? `By ${escapeText(book.author)}\n\n` : ""}## Contents\n\n${tocMarkdown(book.toc, book)}`;
  const articles = [page(rootArticleId, "index.mdx", book.title, intro, createdAt, null, 0)];
  let total = new TextEncoder().encode(intro).byteLength;
  for (const [index, chapter] of chapters.entries()) {
    const body = await chapterToMdx(chapter, chapters, paths, issues);
    if (!body.trim())
      issues.push({
        code: "chapter-empty",
        message: `The chapter ${chapter.path} has no editable text after unsupported content is removed. Its page is retained.`,
        chapter: chapter.title,
      });
    const mdx = `${metadata(chapter.title, book, index)}${body || `# ${escapeText(chapter.title)}\n\nNo editable content was available in this chapter.`}\n`;
    total += new TextEncoder().encode(mdx).byteLength;
    if (total > MAX_BOOK_SOURCE_BYTES)
      throw new Error(
        "The converted book exceeds the 16 MiB MDX source limit. No book has been saved."
      );
    validateBookMdx(mdx, chapter.title);
    articles.push(
      page(chapter.articleId, chapter.filename, chapter.title, mdx, createdAt, rootArticleId, index)
    );
  }
  validateBookMdx(intro, book.title);
  const uniqueIssues = Array.from(
    new Map(
      issues.map((issue) => [`${issue.code}:${issue.chapter ?? ""}:${issue.message}`, issue])
    ).values()
  );
  return { book, articles, assets, sourceRevision: source.revision, issues: uniqueIssues };
}
