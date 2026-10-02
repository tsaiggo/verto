import { IDBFactory, IDBObjectStore as FakeObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBrowserArticle, listBrowserArticles, saveBrowserArticle } from "./browser-articles";
import {
  checkedImportedDocument,
  deleteImportedDocument,
  importDocument,
  importedDocumentHref,
  listImportedDocuments,
  MAX_IMPORTED_DOCUMENT_BYTES,
  readImportedDocument,
  readImportedDocumentMetadata,
  subscribeImportedDocuments,
} from "./imported-documents";
import { DOCUMENT_BYTES_STORE, DOCUMENT_STORE, openLibraryDatabase } from "./local-library-storage";

function pdfBytes(): ArrayBuffer {
  return new TextEncoder().encode("%PDF-1.7\nBinary \u0000 original\r\n%%EOF").buffer;
}

describe("original reading file storage", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("stores exact original bytes separately from lightweight parsed metadata", async () => {
    const original = pdfBytes();
    const record = await importDocument({
      filename: "original.PDF",
      bytes: original,
      title: " 阅读文档 ",
      author: "Ada",
      language: "zh",
      pageCount: 4,
    });
    new Uint8Array(original).fill(0);
    expect(record).toMatchObject({
      title: "阅读文档",
      author: "Ada",
      language: "zh",
      pageCount: 4,
      revision: 1,
      format: "pdf",
    });
    expect(record).not.toHaveProperty("bytes");
    expect(await listImportedDocuments()).toEqual([record]);
    expect(await readImportedDocumentMetadata(record.id)).toEqual(record);
    expect(await readImportedDocumentMetadata("missing")).toBeNull();
    const reopened = await readImportedDocument(record.id);
    expect(reopened?.document).toEqual(record);
    expect(reopened?.bytes).toEqual(pdfBytes());
    expect(await readImportedDocument("missing")).toBeNull();
    expect(importedDocumentHref("a /?b")).toBe("/read/file?document=a%20%2F%3Fb");
  });

  it("supports EPUB metadata and shares the upgraded database with unchanged Markdown articles", async () => {
    const article = createBrowserArticle({ filename: "source.md", source: "\uFEFF# 原文\r\n" });
    const saved = await saveBrowserArticle(article, null);
    const zip = Uint8Array.from([80, 75, 3, 4, 0, 255]).buffer;
    const record = await importDocument({ filename: "reading-book.epub", bytes: zip });
    expect(record).toMatchObject({
      format: "epub",
      title: "Reading Book",
      byteLength: zip.byteLength,
    });
    expect((await readImportedDocument(record.id))?.bytes).toEqual(zip);
    expect((await listBrowserArticles())[0]).toEqual(
      saved.status === "saved" ? saved.article : null
    );
  });

  it("validates format, original bytes, size and parsed metadata before storing anything", async () => {
    await expect(
      importDocument({ filename: "fake.pdf", bytes: new TextEncoder().encode("not a PDF").buffer })
    ).rejects.toThrow("valid PDF");
    await expect(importDocument({ filename: "fake.epub", bytes: pdfBytes() })).rejects.toThrow(
      "valid EPUB"
    );
    await expect(importDocument({ filename: "fake.exe", bytes: pdfBytes() })).rejects.toThrow(
      "invalid"
    );
    await expect(
      importDocument({ filename: "mismatch.epub", format: "pdf", bytes: pdfBytes() })
    ).rejects.toThrow("invalid");
    await expect(
      importDocument({ filename: "empty.pdf", bytes: new ArrayBuffer(0) })
    ).rejects.toThrow("valid PDF");
    await expect(
      importDocument({
        filename: "huge.pdf",
        bytes: new ArrayBuffer(MAX_IMPORTED_DOCUMENT_BYTES + 1),
      })
    ).rejects.toThrow("50 MB");
    await expect(
      importDocument({ filename: "invalid.pdf", bytes: pdfBytes(), pageCount: -1 })
    ).rejects.toThrow("invalid");
    await expect(
      importDocument({ filename: "invalid.pdf", bytes: "invalid" as unknown as ArrayBuffer })
    ).rejects.toThrow("bytes");
    expect(() => checkedImportedDocument(null)).toThrow("invalid");
    expect(await listImportedDocuments()).toEqual([]);
  });

  it("rolls back metadata if storing original bytes fails, and emits no success notification", async () => {
    const target = Object.assign(new EventTarget(), { localStorage: { setItem: vi.fn() } });
    vi.stubGlobal("window", target);
    vi.stubGlobal("BroadcastChannel", undefined);
    const listener = vi.fn();
    const unsubscribe = subscribeImportedDocuments(listener);
    const add = FakeObjectStore.prototype.add;
    vi.spyOn(FakeObjectStore.prototype, "add").mockImplementation(function (
      this: IDBObjectStore,
      value,
      key
    ) {
      if (this.name === DOCUMENT_BYTES_STORE)
        throw new DOMException("Storage full", "QuotaExceededError");
      return add.call(this, value, key);
    });
    await expect(importDocument({ filename: "save.pdf", bytes: pdfBytes() })).rejects.toThrow(
      "Storage full"
    );
    expect(await listImportedDocuments()).toEqual([]);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("reports missing or mismatched original bytes without returning damaged content", async () => {
    const record = await importDocument({ filename: "save.pdf", bytes: pdfBytes() });
    const database = await openLibraryDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(DOCUMENT_BYTES_STORE, "readwrite");
      transaction.objectStore(DOCUMENT_BYTES_STORE).put(new ArrayBuffer(2), record.id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    await expect(readImportedDocument(record.id)).rejects.toThrow("damaged");
    expect(await readImportedDocumentMetadata(record.id)).toEqual(record);
  });

  it("deletes metadata and bytes atomically and refuses stale revisions", async () => {
    const record = await importDocument({ filename: "save.pdf", bytes: pdfBytes() });
    expect(await deleteImportedDocument(record.id, 0)).toEqual({
      status: "conflict",
      document: record,
    });
    const remove = FakeObjectStore.prototype.delete;
    vi.spyOn(FakeObjectStore.prototype, "delete").mockImplementationOnce(function (
      this: IDBObjectStore,
      key
    ) {
      const request = remove.call(this, key);
      this.transaction.abort();
      return request;
    });
    await expect(deleteImportedDocument(record.id, 1)).rejects.toThrow();
    expect((await readImportedDocument(record.id))?.bytes).toEqual(pdfBytes());
    expect(await deleteImportedDocument(record.id, 1)).toEqual({ status: "deleted" });
    expect(await readImportedDocument(record.id)).toBeNull();
    const database = await openLibraryDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([DOCUMENT_STORE, DOCUMENT_BYTES_STORE], "readonly");
      const request = transaction.objectStore(DOCUMENT_BYTES_STORE).get(record.id);
      transaction.oncomplete = () => {
        expect(request.result).toBeUndefined();
        resolve();
      };
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    expect(await deleteImportedDocument(record.id, 1)).toEqual({ status: "missing" });
    await expect(deleteImportedDocument(record.id, -1)).rejects.toThrow("revision");
  });

  it("does not conceal denied browser access as an empty reading library", async () => {
    vi.stubGlobal("indexedDB", undefined);
    await expect(listImportedDocuments()).rejects.toThrow("unavailable");
    await expect(readImportedDocument("id")).rejects.toThrow("unavailable");
    await expect(readImportedDocumentMetadata("id")).rejects.toThrow("unavailable");
    await expect(deleteImportedDocument("id", 1)).rejects.toThrow("unavailable");
  });
});
