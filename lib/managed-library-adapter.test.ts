import { IDBFactory, IDBObjectStore as FakeObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const native = vi.hoisted(() => ({ isTauri: vi.fn(), invoke: vi.fn() }));
vi.mock("./tauri", () => ({ isTauri: native.isTauri, tauriInvoke: native.invoke }));
import {
  articleStorageLabel,
  createBrowserArticle,
  deleteBrowserArticle,
  listArticlesInBrowser,
  listBrowserArticles,
  readBrowserArticle,
  saveBrowserArticle,
  updateBrowserArticleMetadata,
} from "./browser-articles";
import {
  deleteImportedDocument,
  importDocument,
  listDocumentsInBrowser,
  listImportedDocuments,
  readDocumentInBrowser,
  readImportedDocument,
  readImportedDocumentMetadata,
} from "./imported-documents";
import { migrateBrowserLibraryToNative } from "./library-migration";
import { encodeDocumentBytes, decodeDocumentBytes } from "./document-bytes";
import {
  findMdxBookForArticle,
  listMdxBooks,
  MdxBookAlreadyExistsError,
  readMdxBookSnapshot,
  saveConvertedBook,
} from "./mdx-books/storage";
import type { MdxBookDraft } from "./mdx-books/types";
import {
  DOCUMENT_STORE,
  DOCUMENT_BYTES_STORE,
  ARTICLE_STORE,
  MDX_BOOK_STORE,
  BOOK_ASSET_STORE,
  openLibraryDatabase,
} from "./local-library-storage";

function articleFixture() {
  return {
    ...createBrowserArticle({
      filename: "native.md",
      source: "\uFEFF# Exact\r\n",
      title: "My page",
      parentId: null,
    }),
    revision: 4,
  };
}
function bytes(): ArrayBuffer {
  return new TextEncoder().encode("%PDF-1.7\nOriginal\n").buffer;
}
function documentFixture() {
  return {
    id: "native-pdf",
    filename: "paper.pdf",
    title: "Paper",
    format: "pdf" as const,
    byteLength: bytes().byteLength,
    revision: 1,
    createdAt: "2026-10-02T01:00:00.000Z",
    updatedAt: "2026-10-02T01:00:00.000Z",
  };
}

function bookFixture(sourceDocumentId = "native-epub"): MdxBookDraft {
  const root = createBrowserArticle({
    filename: "index.mdx",
    source: "# Native book",
    status: "saved",
  });
  const chapter = createBrowserArticle({
    filename: "chapter.mdx",
    source: "# Exact chapter\r\n",
    parentId: root.id,
    status: "saved",
  });
  return {
    book: {
      id: "native-book",
      rootArticleId: root.id,
      sourceDocumentId,
      title: "Native book",
      createdAt: root.createdAt,
      chapterFiles: [
        { articleId: chapter.id, filename: chapter.filename, originalPath: "OPS/chapter.xhtml" },
      ],
      toc: [{ title: "Chapter", articleId: chapter.id, children: [] }],
    },
    articles: [root, chapter],
    assets: [
      {
        id: "image",
        bookId: "native-book",
        filename: "image.png",
        mime: "image/png",
        bytes: Uint8Array.from([0, 255, 1]).buffer,
      },
    ],
    sourceRevision: 1,
    issues: [],
  };
}

describe("managed content native adapter", () => {
  beforeEach(() => {
    native.isTauri.mockReturnValue(true);
    native.invoke.mockReset();
    vi.stubGlobal("indexedDB", new IDBFactory());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("routes article operations through explicit native commands with exact CAS and source", async () => {
    const article = articleFixture();
    native.invoke.mockResolvedValueOnce([article]);
    expect(await listBrowserArticles()).toEqual([article]);
    native.invoke.mockResolvedValueOnce(article);
    expect(await readBrowserArticle(article.id)).toEqual(article);
    native.invoke.mockResolvedValueOnce(null);
    expect(await readBrowserArticle("missing")).toBeNull();
    native.invoke.mockResolvedValueOnce({ status: "saved", article });
    expect(await saveBrowserArticle(article, 3)).toEqual({ status: "saved", article });
    expect(native.invoke).toHaveBeenLastCalledWith("save_managed_article", {
      article,
      expectedRevision: 3,
    });
    native.invoke.mockResolvedValueOnce({ status: "conflict", article });
    expect(
      await updateBrowserArticleMetadata(
        article.id,
        { title: "New title", source: "Ignored" } as unknown as { title: string },
        3
      )
    ).toEqual({ status: "conflict", article });
    expect(native.invoke).toHaveBeenLastCalledWith("update_managed_article", {
      id: article.id,
      changes: { title: "New title" },
      expectedRevision: 3,
    });
    native.invoke.mockResolvedValueOnce({ status: "missing" });
    expect(await saveBrowserArticle(article, 3)).toEqual({ status: "missing" });
    native.invoke.mockResolvedValueOnce({ status: "deleted" });
    expect(await deleteBrowserArticle(article.id, 4)).toEqual({ status: "deleted" });
    expect(articleStorageLabel()).toBe("On this device");
    expect(await listArticlesInBrowser()).toEqual([]);
  });

  it("loads tab metadata without original bytes and stores and reads native immutable originals", async () => {
    const document = documentFixture();
    native.invoke.mockResolvedValueOnce(document);
    expect(await readImportedDocumentMetadata(document.id)).toEqual(document);
    expect(native.invoke).toHaveBeenLastCalledWith("read_managed_document_metadata", {
      id: document.id,
    });
    native.invoke.mockResolvedValueOnce([document]);
    expect(await listImportedDocuments()).toEqual([document]);
    native.invoke.mockResolvedValueOnce(null);
    expect(await readImportedDocument("missing")).toBeNull();
    native.invoke.mockResolvedValueOnce({ document, bytes: encodeDocumentBytes(bytes()) });
    expect((await readImportedDocument(document.id))?.bytes).toEqual(bytes());
    native.invoke.mockResolvedValueOnce(document);
    expect(await importDocument({ filename: "paper.pdf", bytes: bytes() })).toEqual(document);
    expect(native.invoke).toHaveBeenLastCalledWith(
      "import_managed_document",
      expect.objectContaining({ bytes: encodeDocumentBytes(bytes()) })
    );
    native.invoke.mockResolvedValueOnce({ status: "deleted" });
    expect(await deleteImportedDocument(document.id, 1)).toEqual({ status: "deleted" });
    expect(await listDocumentsInBrowser()).toEqual([]);
  });

  it("surfaces native failures rather than silently falling back to browser storage", async () => {
    native.invoke.mockRejectedValue(new Error("Device manifest is damaged"));
    await expect(listBrowserArticles()).rejects.toThrow("damaged");
    await expect(listImportedDocuments()).rejects.toThrow("damaged");
    await expect(saveBrowserArticle(articleFixture(), null)).rejects.toThrow("damaged");
    expect(await listArticlesInBrowser()).toEqual([]);
  });

  it("explicit migration is additive, preserving browser source revisions and bytes after success", async () => {
    native.isTauri.mockReturnValue(false);
    const saved = await saveBrowserArticle(articleFixture(), null);
    if (saved.status !== "saved") throw new Error("fixture failed");
    const document = await importDocument({ filename: "paper.pdf", bytes: bytes(), author: "Ada" });
    native.isTauri.mockReturnValue(true);
    native.invoke.mockResolvedValue({ articlesCopied: 1, documentsCopied: 1, alreadyPresent: 0 });
    expect(await migrateBrowserLibraryToNative()).toEqual({
      articlesCopied: 1,
      documentsCopied: 1,
      alreadyPresent: 0,
    });
    expect(native.invoke).toHaveBeenLastCalledWith("migrate_managed_library", {
      articles: [saved.article],
      documents: [{ document, bytes: encodeDocumentBytes(bytes()) }],
      books: [],
      assets: [],
    });
    expect(await listArticlesInBrowser()).toEqual([saved.article]);
    expect((await readDocumentInBrowser(document.id))?.bytes).toEqual(bytes());
  });

  it("failed migration retains browser originals and is unavailable outside native runtime", async () => {
    native.isTauri.mockReturnValue(false);
    const result = await saveBrowserArticle(articleFixture(), null);
    await expect(migrateBrowserLibraryToNative()).rejects.toThrow("desktop");
    native.isTauri.mockReturnValue(true);
    native.invoke.mockRejectedValue(new Error("ID collision; nothing overwritten"));
    await expect(migrateBrowserLibraryToNative()).rejects.toThrow("collision");
    expect(await listArticlesInBrowser()).toEqual(
      result.status === "saved" ? [result.article] : []
    );
  });

  it("copies one coherent three-store snapshot while later browser saves stay in browser originals", async () => {
    native.isTauri.mockReturnValue(false);
    const saved = await saveBrowserArticle(articleFixture(), null);
    if (saved.status !== "saved") throw new Error("fixture failed");
    await importDocument({ filename: "paper.pdf", bytes: bytes() });
    native.isTauri.mockReturnValue(true);
    const getAll = FakeObjectStore.prototype.getAll;
    let queuedEdit: Promise<unknown> | undefined;
    vi.spyOn(FakeObjectStore.prototype, "getAll").mockImplementation(function (
      this: IDBObjectStore,
      ...args
    ) {
      const request = getAll.apply(this, args);
      if (this.name === ARTICLE_STORE && this.transaction.mode === "readonly" && !queuedEdit) {
        queuedEdit = (async () => {
          const database = await openLibraryDatabase();
          try {
            await new Promise<void>((resolve, reject) => {
              const transaction = database.transaction(ARTICLE_STORE, "readwrite");
              transaction
                .objectStore(ARTICLE_STORE)
                .put({ ...saved.article, revision: 2, source: "Later browser source" });
              transaction.oncomplete = () => resolve();
              transaction.onabort = () => reject(transaction.error);
            });
          } finally {
            database.close();
          }
        })();
      }
      return request;
    });
    native.invoke.mockResolvedValue({ articlesCopied: 1, documentsCopied: 1, alreadyPresent: 0 });
    await migrateBrowserLibraryToNative();
    expect(native.invoke).toHaveBeenCalledWith(
      "migrate_managed_library",
      expect.objectContaining({ articles: [saved.article] })
    );
    await queuedEdit;
    expect((await listArticlesInBrowser())[0]).toMatchObject({
      revision: 2,
      source: "Later browser source",
    });
  });

  it("rejects aggregate migration size before reading or encoding original bytes", async () => {
    const database = await openLibraryDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(DOCUMENT_STORE, "readwrite");
      for (const id of ["large-one", "large-two", "large-three"])
        transaction
          .objectStore(DOCUMENT_STORE)
          .put({ ...documentFixture(), id, byteLength: 50 * 1024 * 1024 });
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    const get = vi.spyOn(FakeObjectStore.prototype, "get");
    await expect(migrateBrowserLibraryToNative()).rejects.toThrow("100 MB");
    expect(get).not.toHaveBeenCalled();
    expect(native.invoke).not.toHaveBeenCalled();
    expect(await listDocumentsInBrowser()).toHaveLength(3);
  });

  it("refuses migration with missing original bytes before any native write", async () => {
    native.isTauri.mockReturnValue(false);
    const document = await importDocument({ filename: "paper.pdf", bytes: bytes() });
    const database = await openLibraryDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(DOCUMENT_BYTES_STORE, "readwrite");
      transaction.objectStore(DOCUMENT_BYTES_STORE).delete(document.id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    native.isTauri.mockReturnValue(true);
    await expect(migrateBrowserLibraryToNative()).rejects.toThrow("missing or damaged");
    expect(native.invoke).not.toHaveBeenCalled();
    expect(await listDocumentsInBrowser()).toEqual([document]);
  });

  it("round trips binary payloads larger than the argument chunk without numeric-array inflation", () => {
    const original = Uint8Array.from({ length: 100_000 }, (_, index) => index % 256).buffer;
    const encoded = encodeDocumentBytes(original);
    expect(encoded.length).toBe(Math.ceil(original.byteLength / 3) * 4);
    expect(decodeDocumentBytes(encoded)).toEqual(original);
    expect(decodeDocumentBytes(encodeDocumentBytes(new ArrayBuffer(0))).byteLength).toBe(0);
    expect(() => decodeDocumentBytes("%%invalid%%")).toThrow();
  });

  it("routes converted books through native atomic save and snapshots with compact asset payloads", async () => {
    const draft = bookFixture();
    native.invoke.mockResolvedValueOnce({ book: draft.book });
    expect(await saveConvertedBook(draft)).toEqual(draft.book);
    expect(native.invoke).toHaveBeenLastCalledWith("save_managed_book", {
      draft: expect.objectContaining({
        book: draft.book,
        articles: draft.articles,
        sourceRevision: 1,
        assets: [{ ...draft.assets[0], bytes: encodeDocumentBytes(draft.assets[0].bytes) }],
      }),
    });
    native.invoke.mockResolvedValueOnce({ existingBook: draft.book });
    await expect(saveConvertedBook(draft)).rejects.toBeInstanceOf(MdxBookAlreadyExistsError);
    native.invoke.mockResolvedValueOnce([draft.book]);
    expect(await listMdxBooks()).toEqual([draft.book]);
    native.invoke.mockResolvedValueOnce(draft.book);
    expect(await findMdxBookForArticle(draft.articles[1].id)).toEqual(draft.book);
    native.invoke.mockResolvedValueOnce(null);
    expect(await findMdxBookForArticle("unrelated")).toBeNull();
    native.invoke.mockResolvedValueOnce({
      book: draft.book,
      articles: draft.articles.map((article) => ({ ...article, revision: 1 })),
      assets: draft.assets.map((asset) => ({ ...asset, bytes: encodeDocumentBytes(asset.bytes) })),
    });
    expect((await readMdxBookSnapshot(draft.book.id)).assets[0].bytes).toEqual(
      draft.assets[0].bytes
    );
    expect(native.invoke).toHaveBeenLastCalledWith("read_managed_book_snapshot", {
      bookId: draft.book.id,
    });
  });

  it("migrates converted book membership and assets in the same browser snapshot without deleting browser originals", async () => {
    native.isTauri.mockReturnValue(false);
    const epub = await importDocument({
      filename: "original.epub",
      bytes: Uint8Array.from([80, 75, 3, 4, 0, 255]).buffer,
    });
    const draft = bookFixture(epub.id);
    await saveConvertedBook(draft);
    native.isTauri.mockReturnValue(true);
    native.invoke.mockResolvedValue({
      articlesCopied: 2,
      documentsCopied: 1,
      booksCopied: 1,
      assetsCopied: 1,
      alreadyPresent: 0,
    });
    await migrateBrowserLibraryToNative();
    expect(native.invoke).toHaveBeenLastCalledWith(
      "migrate_managed_library",
      expect.objectContaining({
        books: [draft.book],
        assets: [{ ...draft.assets[0], bytes: encodeDocumentBytes(draft.assets[0].bytes) }],
      })
    );
    native.isTauri.mockReturnValue(false);
    expect((await readMdxBookSnapshot(draft.book.id)).assets[0].bytes).toEqual(
      draft.assets[0].bytes
    );
    expect(await listArticlesInBrowser()).toHaveLength(2);
  });

  it("applies the aggregate migration cap to original files plus book assets before loading original bytes", async () => {
    const database = await openLibraryDatabase();
    const draft = bookFixture("large-one");
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        [DOCUMENT_STORE, MDX_BOOK_STORE, BOOK_ASSET_STORE],
        "readwrite"
      );
      for (const id of ["large-one", "large-two"])
        transaction
          .objectStore(DOCUMENT_STORE)
          .put({ ...documentFixture(), id, byteLength: 50 * 1024 * 1024 });
      transaction.objectStore(MDX_BOOK_STORE).put(draft.book);
      transaction.objectStore(BOOK_ASSET_STORE).put(draft.assets[0]);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    const get = vi.spyOn(FakeObjectStore.prototype, "get");
    await expect(migrateBrowserLibraryToNative()).rejects.toThrow(
      "100 MB of reading files and book assets"
    );
    expect(get).not.toHaveBeenCalled();
    expect(native.invoke).not.toHaveBeenCalled();
  });
});
