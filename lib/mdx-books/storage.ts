import { checkedBrowserArticle } from "@/lib/browser-articles";
import { decodeDocumentBytes, encodeDocumentBytes } from "@/lib/document-bytes";
import { checkedImportedDocument } from "@/lib/imported-documents";
import {
  ARTICLE_STORE,
  BOOK_ASSET_STORE,
  DOCUMENT_STORE,
  MDX_BOOK_STORE,
  notifyLocalLibraryChange,
  openLibraryDatabase,
} from "@/lib/local-library-storage";
import { isTauri, tauriInvoke } from "@/lib/tauri";
import {
  checkedBookAsset,
  checkedMdxBook,
  snapshotBookArticles,
  validateBookDraft,
} from "./storage-validation";
import type { BookAsset, MdxBookDraft, MdxBookRecord, MdxBookSnapshot } from "./types";

export class MdxBookAlreadyExistsError extends Error {
  constructor(public readonly existingBook: MdxBookRecord) {
    super("This EPUB already has an editable book. Open that book to keep your existing edits.");
    this.name = "MdxBookAlreadyExistsError";
  }
}

export async function saveConvertedBook(draft: MdxBookDraft): Promise<MdxBookRecord> {
  const input = validateBookDraft(draft);
  // Freeze asset payloads before the first await, matching ordinary document imports.
  const assets = input.assets.map((asset) => ({ ...asset, bytes: asset.bytes.slice(0) }));
  if (isTauri()) {
    const result = await tauriInvoke<{ book?: MdxBookRecord; existingBook?: MdxBookRecord }>(
      "save_managed_book",
      {
        draft: {
          ...input,
          assets: assets.map((asset) => ({ ...asset, bytes: encodeDocumentBytes(asset.bytes) })),
        },
      }
    );
    if (result.existingBook)
      throw new MdxBookAlreadyExistsError(checkedMdxBook(result.existingBook));
    const book = checkedMdxBook(result.book);
    notifyLocalLibraryChange();
    return book;
  }
  const database = await openLibraryDatabase();
  try {
    const book = await new Promise<MdxBookRecord>((resolve, reject) => {
      const transaction = database.transaction(
        [ARTICLE_STORE, DOCUMENT_STORE, MDX_BOOK_STORE, BOOK_ASSET_STORE],
        "readwrite"
      );
      const existingBooks = transaction.objectStore(MDX_BOOK_STORE).getAll();
      const source = transaction.objectStore(DOCUMENT_STORE).get(input.book.sourceDocumentId);
      const articles = transaction.objectStore(ARTICLE_STORE).getAll();
      let completed = 0;
      const save = () => {
        if (++completed !== 3) return;
        try {
          const books = (existingBooks.result as unknown[]).map(checkedMdxBook);
          const duplicate = books.find(
            (book) => book.sourceDocumentId === input.book.sourceDocumentId
          );
          if (duplicate) throw new MdxBookAlreadyExistsError(duplicate);
          if (books.some((book) => book.id === input.book.id))
            throw new Error("This book ID already exists; nothing was overwritten.");
          if (source.result === undefined)
            throw new Error(
              "The original EPUB changed or was removed. Reopen it and convert again."
            );
          const original = checkedImportedDocument(source.result);
          if (original.format !== "epub" || original.revision !== input.sourceRevision)
            throw new Error(
              "The original EPUB changed or was removed. Reopen it and convert again."
            );
          const existing = (articles.result as unknown[]).map(checkedBrowserArticle);
          if (input.articles.some((article) => existing.some((item) => item.id === article.id)))
            throw new Error("A converted page ID already exists; nothing was overwritten.");
          const now = new Date().toISOString();
          for (const article of input.articles)
            transaction.objectStore(ARTICLE_STORE).add({ ...article, updatedAt: now, revision: 1 });
          for (const asset of assets) transaction.objectStore(BOOK_ASSET_STORE).add(asset);
          transaction.objectStore(MDX_BOOK_STORE).add(input.book);
        } catch (error) {
          transaction.abort();
          reject(error);
        }
      };
      existingBooks.onsuccess = source.onsuccess = articles.onsuccess = save;
      transaction.oncomplete = () => resolve(input.book);
      transaction.onabort = transaction.onerror = () =>
        reject(
          transaction.error ??
            new Error("The editable book could not be saved. No chapters were added.")
        );
    });
    notifyLocalLibraryChange();
    return book;
  } finally {
    database.close();
  }
}

export async function listMdxBooks(): Promise<MdxBookRecord[]> {
  if (isTauri()) return (await tauriInvoke<unknown[]>("list_managed_books")).map(checkedMdxBook);
  const database = await openLibraryDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(MDX_BOOK_STORE, "readonly");
      const request = transaction.objectStore(MDX_BOOK_STORE).getAll();
      transaction.oncomplete = () => {
        try {
          resolve((request.result as unknown[]).map(checkedMdxBook));
        } catch (error) {
          reject(error);
        }
      };
      transaction.onabort = transaction.onerror = () =>
        reject(transaction.error ?? new Error("Converted books could not be read."));
    });
  } finally {
    database.close();
  }
}

export async function findMdxBookForArticle(articleId: string): Promise<MdxBookRecord | null> {
  // The native command snapshots metadata and current parent relationships under its lock.
  if (isTauri()) {
    const result = await tauriInvoke<unknown>("find_managed_book_for_article", { articleId });
    return result == null ? null : checkedMdxBook(result);
  }
  const database = await openLibraryDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction([MDX_BOOK_STORE, ARTICLE_STORE], "readonly");
      const books = transaction.objectStore(MDX_BOOK_STORE).getAll();
      const pages = transaction.objectStore(ARTICLE_STORE).getAll();
      transaction.oncomplete = () => {
        try {
          const records = (books.result as unknown[]).map(checkedMdxBook);
          const direct = records.find(
            (book) =>
              book.rootArticleId === articleId ||
              book.chapterFiles.some((chapter) => chapter.articleId === articleId)
          );
          if (direct) {
            resolve(direct);
            return;
          }
          const articles = new Map(
            (pages.result as unknown[])
              .map(checkedBrowserArticle)
              .map((article) => [article.id, article])
          );
          const visited = new Set<string>();
          let id: string | null | undefined = articleId;
          while (id && !visited.has(id)) {
            visited.add(id);
            const book = records.find((item) => item.rootArticleId === id);
            if (book) {
              resolve(book);
              return;
            }
            id = articles.get(id)?.parentId;
          }
          resolve(null);
        } catch (error) {
          reject(error);
        }
      };
      transaction.onabort = transaction.onerror = () =>
        reject(transaction.error ?? new Error("The page's book could not be found."));
    });
  } finally {
    database.close();
  }
}

export async function readMdxBookSnapshot(bookId: string): Promise<MdxBookSnapshot> {
  if (isTauri()) {
    const result = await tauriInvoke<
      Omit<MdxBookSnapshot, "assets"> & { assets: (Omit<BookAsset, "bytes"> & { bytes: string })[] }
    >("read_managed_book_snapshot", { bookId });
    return {
      book: checkedMdxBook(result.book),
      articles: result.articles.map(checkedBrowserArticle),
      assets: result.assets.map((asset) =>
        checkedBookAsset({ ...asset, bytes: decodeDocumentBytes(asset.bytes) })
      ),
    };
  }
  const database = await openLibraryDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [MDX_BOOK_STORE, ARTICLE_STORE, BOOK_ASSET_STORE],
        "readonly"
      );
      const bookRequest = transaction.objectStore(MDX_BOOK_STORE).get(bookId);
      const articles = transaction.objectStore(ARTICLE_STORE).getAll();
      const assets = transaction.objectStore(BOOK_ASSET_STORE).index("bookId").getAll(bookId);
      transaction.oncomplete = () => {
        try {
          if (bookRequest.result === undefined)
            throw new Error("This editable book is missing from the library.");
          const book = checkedMdxBook(bookRequest.result);
          resolve({
            book,
            articles: snapshotBookArticles(
              book,
              (articles.result as unknown[]).map(checkedBrowserArticle)
            ),
            assets: (assets.result as unknown[]).map(checkedBookAsset),
          });
        } catch (error) {
          reject(error);
        }
      };
      transaction.onabort = transaction.onerror = () =>
        reject(transaction.error ?? new Error("The editable book snapshot could not be read."));
    });
  } finally {
    database.close();
  }
}
