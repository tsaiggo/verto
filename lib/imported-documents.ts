import { titleFromFilename } from "./content-source/metadata";
import { isTauri, tauriInvoke } from "./tauri";
import { decodeDocumentBytes, encodeDocumentBytes } from "./document-bytes";
import {
  DOCUMENT_BYTES_STORE,
  DOCUMENT_STORE,
  localDocumentId,
  notifyLocalLibraryChange,
  openLibraryDatabase,
  subscribeLocalLibrary,
  validExpectedRevision,
} from "./local-library-storage";

export interface ImportedDocument {
  id: string;
  filename: string;
  title: string;
  format: "pdf" | "epub";
  byteLength: number;
  createdAt: string;
  updatedAt: string;
  revision: number;
  author?: string;
  language?: string;
  pageCount?: number;
}

export interface ImportDocumentOptions {
  filename: string;
  bytes: ArrayBuffer;
  title?: string;
  format?: ImportedDocument["format"];
  author?: string;
  language?: string;
  pageCount?: number;
}

export type ImportedDocumentDeleteResult =
  | { status: "deleted" | "missing" }
  | { status: "conflict"; document: ImportedDocument };

export const MAX_IMPORTED_DOCUMENT_BYTES = 50 * 1024 * 1024;

export function checkedImportedDocument(value: unknown): ImportedDocument {
  if (!value || typeof value !== "object") throw new Error("A stored reading file is invalid.");
  const document = value as ImportedDocument;
  if (
    typeof document.id !== "string" ||
    !document.id ||
    typeof document.filename !== "string" ||
    !/\.(pdf|epub)$/i.test(document.filename) ||
    typeof document.title !== "string" ||
    !document.title.trim() ||
    (document.format !== "pdf" && document.format !== "epub") ||
    !document.filename.toLowerCase().endsWith(`.${document.format}`) ||
    !Number.isSafeInteger(document.byteLength) ||
    document.byteLength <= 0 ||
    document.byteLength > MAX_IMPORTED_DOCUMENT_BYTES ||
    !Number.isSafeInteger(document.revision) ||
    document.revision < 1 ||
    typeof document.createdAt !== "string" ||
    !Number.isFinite(Date.parse(document.createdAt)) ||
    typeof document.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(document.updatedAt)) ||
    (document.author !== undefined && typeof document.author !== "string") ||
    (document.language !== undefined && typeof document.language !== "string") ||
    (document.pageCount !== undefined &&
      (!Number.isSafeInteger(document.pageCount) || document.pageCount < 1))
  )
    throw new Error("A stored reading file is invalid.");
  return {
    id: document.id,
    filename: document.filename,
    title: document.title,
    format: document.format,
    byteLength: document.byteLength,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    revision: document.revision,
    ...(document.author === undefined ? {} : { author: document.author }),
    ...(document.language === undefined ? {} : { language: document.language }),
    ...(document.pageCount === undefined ? {} : { pageCount: document.pageCount }),
  };
}

function checkedBytes(value: unknown, document: ImportedDocument): ArrayBuffer {
  if (!(value instanceof ArrayBuffer) || value.byteLength !== document.byteLength)
    throw new Error(
      "The original reading file is missing or damaged. Import it again from your backup."
    );
  return value;
}

/** Immutable original bytes and metadata commit together. Parsing happens before this call. */
export async function importDocument(options: ImportDocumentOptions): Promise<ImportedDocument> {
  const format = options.format ?? (/\.epub$/i.test(options.filename) ? "epub" : "pdf");
  if (!(options.bytes instanceof ArrayBuffer)) throw new Error("Original file bytes are required.");
  if (options.bytes.byteLength > MAX_IMPORTED_DOCUMENT_BYTES)
    throw new Error("Reading files must be 50 MB or smaller.");
  const bytes = options.bytes.slice(0);
  const prefix = new Uint8Array(bytes, 0, Math.min(5, bytes.byteLength));
  if (
    (format === "pdf" && String.fromCharCode(...prefix) !== "%PDF-") ||
    (format === "epub" &&
      (prefix[0] !== 0x50 || prefix[1] !== 0x4b || prefix[2] !== 3 || prefix[3] !== 4))
  )
    throw new Error(`This file is not a valid ${format.toUpperCase()} file.`);
  const now = new Date().toISOString();
  const document = checkedImportedDocument({
    ...options,
    bytes: undefined,
    id: localDocumentId(),
    format,
    revision: 1,
    byteLength: bytes.byteLength,
    title:
      options.title?.trim() ||
      titleFromFilename(options.filename.replace(/\.(epub|pdf)$/i, "")) ||
      "Untitled reading file",
    createdAt: now,
    updatedAt: now,
  });
  if (isTauri()) {
    const saved = checkedImportedDocument(
      await tauriInvoke<unknown>("import_managed_document", {
        document,
        bytes: encodeDocumentBytes(bytes),
      })
    );
    notifyLocalLibraryChange();
    return saved;
  }
  const database = await openLibraryDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([DOCUMENT_STORE, DOCUMENT_BYTES_STORE], "readwrite");
      try {
        transaction.objectStore(DOCUMENT_STORE).add(document);
        transaction.objectStore(DOCUMENT_BYTES_STORE).add(bytes, document.id);
      } catch (error) {
        transaction.abort();
        reject(error);
      }
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () =>
        reject(transaction.error ?? new Error("The reading file could not be saved."));
    });
  } finally {
    database.close();
  }
  notifyLocalLibraryChange();
  return document;
}

export async function listImportedDocuments(): Promise<ImportedDocument[]> {
  if (isTauri())
    return (await tauriInvoke<unknown[]>("list_managed_documents"))
      .map(checkedImportedDocument)
      .sort(sortDocuments);
  return listDocumentsInBrowser();
}

/** Lightweight tabs and library labels never need to load original file bytes. */
export async function readImportedDocumentMetadata(id: string): Promise<ImportedDocument | null> {
  if (isTauri()) {
    const document = await tauriInvoke<unknown>("read_managed_document_metadata", { id });
    return document == null ? null : checkedImportedDocument(document);
  }
  const database = await openLibraryDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(DOCUMENT_STORE, "readonly");
      const request = transaction.objectStore(DOCUMENT_STORE).get(id);
      transaction.oncomplete = () => {
        try {
          resolve(request.result === undefined ? null : checkedImportedDocument(request.result));
        } catch (error) {
          reject(error);
        }
      };
      transaction.onabort = transaction.onerror = () =>
        reject(transaction.error ?? new Error("The reading file could not be loaded."));
    });
  } finally {
    database.close();
  }
}

export async function listDocumentsInBrowser(): Promise<ImportedDocument[]> {
  const database = await openLibraryDatabase();
  try {
    return await new Promise<ImportedDocument[]>((resolve, reject) => {
      const transaction = database.transaction(DOCUMENT_STORE, "readonly");
      const request = transaction.objectStore(DOCUMENT_STORE).getAll();
      transaction.oncomplete = () => {
        try {
          resolve((request.result as unknown[]).map(checkedImportedDocument).sort(sortDocuments));
        } catch (error) {
          reject(error);
        }
      };
      transaction.onabort = transaction.onerror = () =>
        reject(transaction.error ?? new Error("Reading files could not be loaded."));
    });
  } finally {
    database.close();
  }
}

function sortDocuments(a: ImportedDocument, b: ImportedDocument): number {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id);
}

export async function readImportedDocument(
  id: string
): Promise<{ document: ImportedDocument; bytes: ArrayBuffer } | null> {
  if (isTauri()) {
    const result = await tauriInvoke<{ document: unknown; bytes: string } | null>(
      "read_managed_document",
      { id }
    );
    if (!result) return null;
    const document = checkedImportedDocument(result.document);
    const bytes = decodeDocumentBytes(result.bytes);
    return { document, bytes: checkedBytes(bytes, document) };
  }
  return readDocumentInBrowser(id);
}

export async function readDocumentInBrowser(
  id: string
): Promise<{ document: ImportedDocument; bytes: ArrayBuffer } | null> {
  const database = await openLibraryDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction([DOCUMENT_STORE, DOCUMENT_BYTES_STORE], "readonly");
      const metadata = transaction.objectStore(DOCUMENT_STORE).get(id);
      const bytes = transaction.objectStore(DOCUMENT_BYTES_STORE).get(id);
      transaction.oncomplete = () => {
        try {
          if (metadata.result === undefined) {
            resolve(null);
            return;
          }
          const document = checkedImportedDocument(metadata.result);
          resolve({ document, bytes: checkedBytes(bytes.result, document) });
        } catch (error) {
          reject(error);
        }
      };
      transaction.onabort = transaction.onerror = () =>
        reject(transaction.error ?? new Error("The reading file could not be opened."));
    });
  } finally {
    database.close();
  }
}

export async function deleteImportedDocument(
  id: string,
  expectedRevision: number
): Promise<ImportedDocumentDeleteResult> {
  validExpectedRevision(expectedRevision);
  if (isTauri()) {
    const result = await tauriInvoke<ImportedDocumentDeleteResult>("delete_managed_document", {
      id,
      expectedRevision,
    });
    if (result.status === "deleted") notifyLocalLibraryChange();
    return result;
  }
  const database = await openLibraryDatabase();
  try {
    const result = await new Promise<ImportedDocumentDeleteResult>((resolve, reject) => {
      const transaction = database.transaction([DOCUMENT_STORE, DOCUMENT_BYTES_STORE], "readwrite");
      const metadata = transaction.objectStore(DOCUMENT_STORE);
      const request = metadata.get(id);
      let outcome: ImportedDocumentDeleteResult;
      request.onsuccess = () => {
        try {
          if (request.result === undefined) outcome = { status: "missing" };
          else {
            const document = checkedImportedDocument(request.result);
            if (document.revision !== expectedRevision) outcome = { status: "conflict", document };
            else {
              metadata.delete(id);
              transaction.objectStore(DOCUMENT_BYTES_STORE).delete(id);
              outcome = { status: "deleted" };
            }
          }
        } catch (error) {
          transaction.abort();
          reject(error);
        }
      };
      transaction.oncomplete = () => resolve(outcome);
      transaction.onabort = transaction.onerror = () =>
        reject(transaction.error ?? new Error("The reading file could not be removed."));
    });
    if (result.status === "deleted") notifyLocalLibraryChange();
    return result;
  } finally {
    database.close();
  }
}

export const subscribeImportedDocuments = subscribeLocalLibrary;

export function importedDocumentHref(id: string): string {
  return `/read/file?document=${encodeURIComponent(id)}`;
}
