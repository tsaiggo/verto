import { checkedBrowserArticle, type BrowserArticle } from "@/lib/browser-articles";
import {
  MAX_BOOK_ASSET_BYTES,
  MAX_BOOK_SOURCE_BYTES,
  type BookAsset,
  type BookTocItem,
  type MdxBookDraft,
  type MdxBookRecord,
} from "./types";

export function validOpaqueBookId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function validBookFilename(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 240 &&
    !/[\\/\u0000-\u001f\u007f<>:"|?*]/.test(value) &&
    !/[. ]$/.test(value) &&
    value !== "." &&
    value !== ".." &&
    !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)
  );
}

function checkedToc(value: unknown, depth = 0): BookTocItem[] {
  if (!Array.isArray(value) || depth > 100) throw new Error("The book navigation is invalid.");
  return value.map((raw: unknown) => {
    if (!raw || typeof raw !== "object") throw new Error("The book navigation is invalid.");
    const item = raw as BookTocItem;
    if (
      typeof item.title !== "string" ||
      !validOpaqueBookId(item.articleId) ||
      (item.anchor !== undefined && typeof item.anchor !== "string")
    )
      throw new Error("The book navigation is invalid.");
    return {
      title: item.title,
      articleId: item.articleId,
      ...(item.anchor === undefined ? {} : { anchor: item.anchor }),
      children: checkedToc(item.children, depth + 1),
    };
  });
}

export function checkedMdxBook(value: unknown): MdxBookRecord {
  if (!value || typeof value !== "object") throw new Error("The converted book record is invalid.");
  const book = value as MdxBookRecord;
  if (
    !validOpaqueBookId(book.id) ||
    !validOpaqueBookId(book.rootArticleId) ||
    !validOpaqueBookId(book.sourceDocumentId) ||
    typeof book.title !== "string" ||
    !book.title.trim() ||
    typeof book.createdAt !== "string" ||
    !Number.isFinite(Date.parse(book.createdAt)) ||
    (book.author !== undefined && typeof book.author !== "string") ||
    (book.language !== undefined && typeof book.language !== "string") ||
    !Array.isArray(book.chapterFiles)
  )
    throw new Error("The converted book record is invalid.");
  const ids = new Set<string>();
  const names = new Set<string>();
  const chapterFiles = book.chapterFiles.map((chapter) => {
    if (
      !validOpaqueBookId(chapter.articleId) ||
      !validBookFilename(chapter.filename) ||
      !/\.mdx$/i.test(chapter.filename) ||
      typeof chapter.originalPath !== "string" ||
      ids.has(chapter.articleId) ||
      names.has(chapter.filename.toLowerCase())
    )
      throw new Error("The book chapter map is invalid or contains duplicate filenames.");
    ids.add(chapter.articleId);
    names.add(chapter.filename.toLowerCase());
    return {
      articleId: chapter.articleId,
      filename: chapter.filename,
      originalPath: chapter.originalPath,
    };
  });
  return {
    id: book.id,
    rootArticleId: book.rootArticleId,
    sourceDocumentId: book.sourceDocumentId,
    title: book.title,
    createdAt: book.createdAt,
    chapterFiles,
    toc: checkedToc(book.toc),
    ...(book.author === undefined ? {} : { author: book.author }),
    ...(book.language === undefined ? {} : { language: book.language }),
  };
}

export function checkedBookAsset(value: unknown): BookAsset {
  if (!value || typeof value !== "object") throw new Error("A book asset is invalid.");
  const asset = value as BookAsset;
  if (
    !validOpaqueBookId(asset.id) ||
    !validOpaqueBookId(asset.bookId) ||
    !validBookFilename(asset.filename) ||
    typeof asset.mime !== "string" ||
    !/^[a-z][a-z\d.+-]*\/[a-z\d.+-]+$/i.test(asset.mime) ||
    !(asset.bytes instanceof ArrayBuffer) ||
    asset.bytes.byteLength > MAX_BOOK_ASSET_BYTES
  )
    throw new Error("A book asset is invalid.");
  return {
    id: asset.id,
    bookId: asset.bookId,
    filename: asset.filename,
    mime: asset.mime,
    bytes: asset.bytes,
  };
}

export function validateBookDraft(draft: MdxBookDraft): MdxBookDraft {
  const book = checkedMdxBook(draft.book);
  if (
    !Number.isSafeInteger(draft.sourceRevision) ||
    draft.sourceRevision < 1 ||
    !Array.isArray(draft.articles) ||
    !Array.isArray(draft.assets)
  )
    throw new Error("The conversion draft is invalid.");
  const articles = draft.articles.map(checkedBrowserArticle);
  const map = new Map<string, BrowserArticle>();
  const names = new Set<string>();
  let sourceBytes = 0;
  for (const article of articles) {
    if (
      !validOpaqueBookId(article.id) ||
      !validBookFilename(article.filename) ||
      !/\.mdx$/i.test(article.filename) ||
      article.revision !== 0 ||
      article.status !== "saved" ||
      map.has(article.id) ||
      names.has(article.filename.toLowerCase())
    )
      throw new Error(
        "Converted chapters must be new, saved MDX pages with unique IDs and filenames."
      );
    map.set(article.id, article);
    names.add(article.filename.toLowerCase());
    sourceBytes += new TextEncoder().encode(article.source).byteLength;
  }
  if (sourceBytes > MAX_BOOK_SOURCE_BYTES)
    throw new Error("Converted Markdown source must be 16 MB or smaller.");
  const root = map.get(book.rootArticleId);
  if (!root || root.parentId)
    throw new Error("The converted book root is missing or has a parent.");
  for (const article of articles) {
    const visited = new Set([article.id]);
    let parentId = article.parentId;
    while (parentId) {
      if (visited.has(parentId) || !map.has(parentId))
        throw new Error("The converted book page tree is invalid.");
      visited.add(parentId);
      parentId = map.get(parentId)?.parentId;
    }
    if (article.id !== book.rootArticleId && !visited.has(book.rootArticleId))
      throw new Error("All converted chapters must belong to this book root.");
  }
  for (const chapter of book.chapterFiles)
    if (map.get(chapter.articleId)?.filename !== chapter.filename)
      throw new Error("The converted chapter filename does not match its page.");
  const checkTocReferences = (items: BookTocItem[]) => {
    for (const item of items) {
      if (!map.has(item.articleId))
        throw new Error("Book navigation references a missing chapter.");
      checkTocReferences(item.children);
    }
  };
  checkTocReferences(book.toc);
  const assets = draft.assets.map(checkedBookAsset);
  const assetIds = new Set<string>();
  const assetNames = new Set<string>();
  let assetBytes = 0;
  for (const asset of assets) {
    if (
      asset.bookId !== book.id ||
      assetIds.has(asset.id) ||
      assetNames.has(asset.filename.toLowerCase())
    )
      throw new Error("Book assets must belong to this book and have unique IDs and filenames.");
    assetIds.add(asset.id);
    assetNames.add(asset.filename.toLowerCase());
    assetBytes += asset.bytes.byteLength;
  }
  if (assetBytes > MAX_BOOK_ASSET_BYTES)
    throw new Error("Converted book assets must be 100 MB or smaller.");
  return { ...draft, book, articles, assets };
}

/** Initial chapter membership survives moves; new descendants join through the current tree. */
export function snapshotBookArticles(
  book: MdxBookRecord,
  articles: BrowserArticle[]
): BrowserArticle[] {
  if (!articles.some((article) => article.id === book.rootArticleId))
    throw new Error(
      "The converted book's root page was removed. Its original EPUB and other pages are unchanged."
    );
  const descendants = new Set([book.rootArticleId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const article of articles)
      if (article.parentId && descendants.has(article.parentId) && !descendants.has(article.id)) {
        descendants.add(article.id);
        changed = true;
      }
  }
  const members = new Set([
    ...descendants,
    ...book.chapterFiles.map((chapter) => chapter.articleId),
  ]);
  return articles.filter((article) => members.has(article.id));
}
