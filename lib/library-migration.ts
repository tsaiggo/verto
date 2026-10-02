import { checkedBrowserArticle, type BrowserArticle } from "./browser-articles";
import { encodeDocumentBytes } from "./document-bytes";
import { checkedImportedDocument, type ImportedDocument } from "./imported-documents";
import {
  ARTICLE_STORE,
  DOCUMENT_BYTES_STORE,
  DOCUMENT_STORE,
  notifyLocalLibraryChange,
  openLibraryDatabase,
} from "./local-library-storage";
import { isTauri, tauriInvoke } from "./tauri";
import { BOOK_ASSET_STORE, MDX_BOOK_STORE } from "./local-library-storage";
import { checkedBookAsset, checkedMdxBook } from "./mdx-books/storage-validation";
import type { BookAsset, MdxBookRecord } from "./mdx-books/types";

export interface LibraryMigrationResult {
  articlesCopied: number;
  documentsCopied: number;
  alreadyPresent: number;
  booksCopied?: number;
  assetsCopied?: number;
}

export const MAX_NATIVE_MIGRATION_BYTES = 100 * 1024 * 1024;

interface MigrationSnapshot {
  articles: BrowserArticle[];
  documents: { document: ImportedDocument; bytes: ArrayBuffer }[];
  books: MdxBookRecord[];
  assets: BookAsset[];
}

async function browserSnapshot(): Promise<MigrationSnapshot> {
  const database = await openLibraryDatabase();
  try {
    return await new Promise<MigrationSnapshot>((resolve, reject) => {
      // All stores are locked for this read transaction: a concurrent browser
      // save belongs entirely before or after the copied point-in-time snapshot.
      const transaction = database.transaction(
        [ARTICLE_STORE, DOCUMENT_STORE, DOCUMENT_BYTES_STORE, MDX_BOOK_STORE, BOOK_ASSET_STORE],
        "readonly"
      );
      const articleRequest = transaction.objectStore(ARTICLE_STORE).getAll();
      const documentRequest = transaction.objectStore(DOCUMENT_STORE).getAll();
      const bookRequest = transaction.objectStore(MDX_BOOK_STORE).getAll();
      let documents: ImportedDocument[] = [];
      const assets: BookAsset[] = [];
      const bytes = new Map<string, IDBRequest<unknown>>();
      documentRequest.onsuccess = () => {
        try {
          documents = (documentRequest.result as unknown[]).map(checkedImportedDocument);
          const total = documents.reduce((sum, item) => sum + item.byteLength, 0);
          if (total > MAX_NATIVE_MIGRATION_BYTES)
            throw new Error(
              "One-time migration supports up to 100 MB of reading files. Export and import larger libraries in smaller batches; browser originals are unchanged."
            );
          let allBytes = total;
          const assetRequest = transaction.objectStore(BOOK_ASSET_STORE).openCursor();
          assetRequest.onsuccess = () => {
            try {
              const cursor = assetRequest.result;
              if (!cursor) {
                for (const document of documents)
                  bytes.set(
                    document.id,
                    transaction.objectStore(DOCUMENT_BYTES_STORE).get(document.id)
                  );
                return;
              }
              const asset = checkedBookAsset(cursor.value);
              allBytes += asset.bytes.byteLength;
              if (allBytes > MAX_NATIVE_MIGRATION_BYTES)
                throw new Error(
                  "One-time migration supports up to 100 MB of reading files and book assets. Browser originals are unchanged."
                );
              assets.push(asset);
              cursor.continue();
            } catch (error) {
              transaction.abort();
              reject(error);
            }
          };
        } catch (error) {
          transaction.abort();
          reject(error);
        }
      };
      transaction.oncomplete = () => {
        try {
          resolve({
            articles: (articleRequest.result as unknown[]).map(checkedBrowserArticle),
            documents: documents.map((document) => {
              const original = bytes.get(document.id)?.result;
              if (!(original instanceof ArrayBuffer) || original.byteLength !== document.byteLength)
                throw new Error(
                  "A browser reading file is missing or damaged. Restore it before migrating; browser originals are unchanged."
                );
              return { document, bytes: original };
            }),
            books: (bookRequest.result as unknown[]).map(checkedMdxBook),
            assets,
          });
        } catch (error) {
          reject(error);
        }
      };
      transaction.onabort = transaction.onerror = () =>
        reject(transaction.error ?? new Error("The browser library snapshot could not be read."));
    });
  } finally {
    database.close();
  }
}

/** Explicit additive copy of a point-in-time snapshot. Browser originals are never removed. */
export async function migrateBrowserLibraryToNative(): Promise<LibraryMigrationResult> {
  if (!isTauri())
    throw new Error("Moving browser data to device storage requires the desktop app.");
  const snapshot = await browserSnapshot();
  const result = await tauriInvoke<LibraryMigrationResult>("migrate_managed_library", {
    articles: snapshot.articles,
    documents: snapshot.documents.map(({ document, bytes }) => ({
      document,
      bytes: encodeDocumentBytes(bytes),
    })),
    books: snapshot.books,
    assets: snapshot.assets.map((asset) => ({ ...asset, bytes: encodeDocumentBytes(asset.bytes) })),
  });
  notifyLocalLibraryChange();
  return result;
}
