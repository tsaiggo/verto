import type { BrowserArticle } from "@/lib/browser-articles";

export interface BookTocItem {
  title: string;
  articleId: string;
  anchor?: string;
  children: BookTocItem[];
}

export interface BookChapterFile {
  articleId: string;
  filename: string;
  originalPath: string;
}

export interface MdxBookRecord {
  id: string;
  rootArticleId: string;
  sourceDocumentId: string;
  title: string;
  author?: string;
  language?: string;
  createdAt: string;
  chapterFiles: BookChapterFile[];
  toc: BookTocItem[];
}

export interface BookAsset {
  id: string;
  bookId: string;
  filename: string;
  mime: string;
  bytes: ArrayBuffer;
}

export interface ConversionIssue {
  code: string;
  message: string;
  chapter?: string;
}

export interface MdxBookDraft {
  book: MdxBookRecord;
  articles: BrowserArticle[];
  assets: BookAsset[];
  sourceRevision: number;
  issues: ConversionIssue[];
}

export interface MdxBookSnapshot {
  book: MdxBookRecord;
  articles: BrowserArticle[];
  assets: BookAsset[];
}

export const MAX_BOOK_ASSET_BYTES = 100 * 1024 * 1024;
export const MAX_BOOK_SOURCE_BYTES = 16 * 1024 * 1024;
