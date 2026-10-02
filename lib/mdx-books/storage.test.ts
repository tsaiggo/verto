import { IDBFactory, IDBObjectStore as FakeObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBrowserArticle,
  deleteBrowserArticle,
  listBrowserArticles,
  moveBrowserArticle,
  readBrowserArticle,
  saveBrowserArticle,
} from "@/lib/browser-articles";
import { importDocument, readImportedDocument } from "@/lib/imported-documents";
import {
  BOOK_ASSET_STORE,
  MDX_BOOK_STORE,
  openLibraryDatabase,
  subscribeLocalLibrary,
} from "@/lib/local-library-storage";
import {
  findMdxBookForArticle,
  listMdxBooks,
  MdxBookAlreadyExistsError,
  readMdxBookSnapshot,
  saveConvertedBook,
} from "./storage";
import { validateBookDraft } from "./storage-validation";
import { MAX_BOOK_SOURCE_BYTES, type MdxBookDraft } from "./types";

async function draftFor(sourceId?: string): Promise<MdxBookDraft> {
  const source =
    sourceId ??
    (
      await importDocument({
        filename: "original.epub",
        title: "Original book",
        bytes: Uint8Array.from([80, 75, 3, 4, 1, 2, 3]).buffer,
      })
    ).id;
  const root = createBrowserArticle({
    filename: "index.mdx",
    source: "# Book\n\n[Chapter](./chapter-1.mdx)\n",
    status: "saved",
  });
  const chapter = createBrowserArticle({
    filename: "chapter-1.mdx",
    source: "\uFEFF# Chapter\r\n\r\n![Cover](./assets/cover.png)\r\n",
    parentId: root.id,
    status: "saved",
  });
  const id = crypto.randomUUID();
  return {
    book: {
      id,
      rootArticleId: root.id,
      sourceDocumentId: source,
      title: "Converted book",
      createdAt: new Date().toISOString(),
      chapterFiles: [
        { articleId: chapter.id, filename: chapter.filename, originalPath: "OPS/chapter.xhtml" },
      ],
      toc: [{ title: "Chapter", articleId: chapter.id, children: [] }],
    },
    articles: [root, chapter],
    assets: [
      {
        id: "cover",
        bookId: id,
        filename: "cover.png",
        mime: "image/png",
        bytes: Uint8Array.from([137, 80, 78, 71, 0, 255]).buffer,
      },
    ],
    sourceRevision: 1,
    issues: [],
  };
}

describe("atomic converted MDX book storage", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("commits root, chapters, assets and membership together while retaining the exact original EPUB", async () => {
    const draft = await draftFor();
    const source = await readImportedDocument(draft.book.sourceDocumentId);
    const saved = await saveConvertedBook(draft);
    new Uint8Array(draft.assets[0].bytes).fill(0);
    expect(saved).toEqual(draft.book);
    expect(await listMdxBooks()).toEqual([draft.book]);
    const snapshot = await readMdxBookSnapshot(saved.id);
    expect(snapshot.articles).toHaveLength(2);
    expect(snapshot.articles.find((article) => article.id === draft.articles[1].id)).toMatchObject({
      revision: 1,
      source: draft.articles[1].source,
    });
    expect(new Uint8Array(snapshot.assets[0].bytes)).toEqual(
      Uint8Array.from([137, 80, 78, 71, 0, 255])
    );
    expect(await readImportedDocument(draft.book.sourceDocumentId)).toEqual(source);
    expect(await findMdxBookForArticle(saved.rootArticleId)).toEqual(saved);
    expect(await findMdxBookForArticle(draft.articles[1].id)).toEqual(saved);
    expect(await findMdxBookForArticle("unrelated")).toBeNull();
  });

  it("rolls back every page and asset if the asset store fails, then retries the unchanged draft safely", async () => {
    const draft = await draftFor();
    const target = Object.assign(new EventTarget(), { localStorage: { setItem: vi.fn() } });
    vi.stubGlobal("window", target);
    vi.stubGlobal("BroadcastChannel", undefined);
    const notified = vi.fn();
    const unsubscribe = subscribeLocalLibrary(notified);
    const add = FakeObjectStore.prototype.add;
    const failure = vi.spyOn(FakeObjectStore.prototype, "add").mockImplementation(function (
      this: IDBObjectStore,
      value,
      key
    ) {
      if (this.name === BOOK_ASSET_STORE)
        throw new DOMException("Book asset quota exceeded", "QuotaExceededError");
      return add.call(this, value, key);
    });
    await expect(saveConvertedBook(draft)).rejects.toThrow("quota");
    expect(await listBrowserArticles()).toEqual([]);
    expect(await listMdxBooks()).toEqual([]);
    expect(notified).not.toHaveBeenCalled();
    failure.mockRestore();
    await saveConvertedBook(draft);
    expect((await readMdxBookSnapshot(draft.book.id)).assets).toHaveLength(1);
    expect(notified).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("serializes duplicate conversions and refuses to replace existing edited chapters", async () => {
    const first = await draftFor();
    const second = await draftFor(first.book.sourceDocumentId);
    const results = await Promise.allSettled([saveConvertedBook(first), saveConvertedBook(second)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(
      MdxBookAlreadyExistsError
    );
    const book = (await listMdxBooks())[0];
    const chapter = (await readMdxBookSnapshot(book.id)).articles.find(
      (article) => article.id !== book.rootArticleId
    )!;
    await saveBrowserArticle({ ...chapter, source: "Edited after conversion" }, chapter.revision);
    await expect(
      saveConvertedBook(await draftFor(first.book.sourceDocumentId))
    ).rejects.toMatchObject({ existingBook: book });
    expect((await readBrowserArticle(chapter.id))?.source).toBe("Edited after conversion");
    expect(await listBrowserArticles()).toHaveLength(2);
  });

  it("checks original EPUB format and revision before adding any converted pages", async () => {
    const draft = await draftFor();
    await expect(saveConvertedBook({ ...draft, sourceRevision: 2 })).rejects.toThrow(
      "changed or was removed"
    );
    const pdf = await importDocument({
      filename: "paper.pdf",
      bytes: new TextEncoder().encode("%PDF-1.7\n").buffer,
    });
    await expect(
      saveConvertedBook({ ...draft, book: { ...draft.book, sourceDocumentId: pdf.id } })
    ).rejects.toThrow("original EPUB");
    await expect(
      saveConvertedBook({ ...draft, book: { ...draft.book, sourceDocumentId: "missing" } })
    ).rejects.toThrow("removed");
    expect(await listBrowserArticles()).toEqual([]);
    expect(await listMdxBooks()).toEqual([]);
  });

  it("snapshots current edits, surviving original members and current root descendants with deleted links retained in metadata", async () => {
    const draft = await draftFor();
    await saveConvertedBook(draft);
    const chapter = (await readBrowserArticle(draft.articles[1].id))!;
    await saveBrowserArticle({ ...chapter, source: "# Edited chapter" }, chapter.revision);
    const childResult = await saveBrowserArticle(
      createBrowserArticle({
        filename: "new-page.mdx",
        source: "New root descendant",
        parentId: draft.book.rootArticleId,
        status: "saved",
      }),
      null
    );
    if (childResult.status !== "saved") throw new Error("fixture failed");
    expect(await findMdxBookForArticle(childResult.article.id)).toEqual(draft.book);
    const moved = await moveBrowserArticle(chapter.id, null, 2);
    if (moved.status !== "saved") throw new Error("fixture failed");
    const outsideResult = await saveBrowserArticle(
      createBrowserArticle({
        filename: "outside.mdx",
        source: "Outside root",
        parentId: chapter.id,
        status: "saved",
      }),
      null
    );
    if (outsideResult.status !== "saved") throw new Error("fixture failed");
    const snapshot = await readMdxBookSnapshot(draft.book.id);
    expect(snapshot.articles.map((article) => article.id)).toEqual(
      expect.arrayContaining([chapter.id, childResult.article.id, draft.book.rootArticleId])
    );
    expect(snapshot.articles.map((article) => article.id)).not.toContain(outsideResult.article.id);
    await deleteBrowserArticle(outsideResult.article.id, 1);
    await deleteBrowserArticle(chapter.id, 3);
    const afterDelete = await readMdxBookSnapshot(draft.book.id);
    expect(afterDelete.articles.map((article) => article.id)).not.toContain(chapter.id);
    expect(afterDelete.book.chapterFiles[0].articleId).toBe(chapter.id);
    await moveBrowserArticle(childResult.article.id, null, 1);
    await deleteBrowserArticle(draft.book.rootArticleId, 1);
    await expect(readMdxBookSnapshot(draft.book.id)).rejects.toThrow("root page was removed");
    expect((await readBrowserArticle(childResult.article.id))?.source).toBe("New root descendant");
  });

  it("rejects unsafe paths, duplicate filenames, foreign parents, stale pages, broken maps and overlarge source before writing", async () => {
    const draft = await draftFor();
    for (const name of ["../outside.png", "C:\\outside.png", "nested/image.png", "CON.png"])
      expect(() =>
        validateBookDraft({ ...draft, assets: [{ ...draft.assets[0], filename: name }] })
      ).toThrow("asset");
    expect(() =>
      validateBookDraft({
        ...draft,
        articles: [{ ...draft.articles[0], revision: 1 }, draft.articles[1]],
      })
    ).toThrow("new");
    expect(() =>
      validateBookDraft({
        ...draft,
        articles: [draft.articles[0], { ...draft.articles[1], parentId: "other-page" }],
      })
    ).toThrow("tree");
    expect(() =>
      validateBookDraft({
        ...draft,
        book: {
          ...draft.book,
          chapterFiles: [{ ...draft.book.chapterFiles[0], filename: "wrong.mdx" }],
        },
      })
    ).toThrow("filename");
    expect(() =>
      validateBookDraft({
        ...draft,
        assets: [draft.assets[0], { ...draft.assets[0], id: "second", filename: "COVER.PNG" }],
      })
    ).toThrow("unique");
    expect(() =>
      validateBookDraft({
        ...draft,
        articles: [
          { ...draft.articles[0], source: "x".repeat(MAX_BOOK_SOURCE_BYTES + 1) },
          draft.articles[1],
        ],
      })
    ).toThrow("16 MB");
    expect(await listBrowserArticles()).toEqual([]);
  });

  it("rejects existing page ID collisions without overwriting the unrelated document", async () => {
    const draft = await draftFor();
    await saveBrowserArticle({ ...draft.articles[0], source: "Unrelated saved document" }, null);
    await expect(saveConvertedBook(draft)).rejects.toThrow("page ID already exists");
    expect((await readBrowserArticle(draft.articles[0].id))?.source).toBe(
      "Unrelated saved document"
    );
    expect(await listMdxBooks()).toEqual([]);
  });

  it("upgrades version two without changing source articles or imported originals", async () => {
    const article = createBrowserArticle({ filename: "legacy.md", source: "\uFEFF# Legacy\r\n" });
    const originalBytes = Uint8Array.from([80, 75, 3, 4, 0, 255]).buffer;
    const original = {
      id: "legacy-epub",
      filename: "legacy.epub",
      title: "Legacy original",
      format: "epub" as const,
      byteLength: originalBytes.byteLength,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      revision: 1,
    };
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("verto.articles", 2);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("articles", { keyPath: "id" });
        request.result.createObjectStore("documents", { keyPath: "id" });
        request.result.createObjectStore("document-bytes");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        ["articles", "documents", "document-bytes"],
        "readwrite"
      );
      transaction.objectStore("articles").add({ ...article, revision: 4 });
      transaction.objectStore("documents").add(original);
      transaction.objectStore("document-bytes").add(originalBytes, original.id);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    expect((await readBrowserArticle(article.id))?.source).toBe(article.source);
    expect(await readImportedDocument(original.id)).toEqual({
      document: original,
      bytes: originalBytes,
    });
    const upgraded = await openLibraryDatabase();
    expect(upgraded.version).toBe(3);
    expect(upgraded.objectStoreNames.contains(MDX_BOOK_STORE)).toBe(true);
    upgraded.close();
  });

  it("reports missing records and damaged asset data without fabricating an empty book", async () => {
    await expect(readMdxBookSnapshot("missing-book")).rejects.toThrow("missing");
    const draft = await draftFor();
    await saveConvertedBook(draft);
    const database = await openLibraryDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(BOOK_ASSET_STORE, "readwrite");
      transaction.objectStore(BOOK_ASSET_STORE).put({ ...draft.assets[0], bytes: "damaged" });
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    await expect(readMdxBookSnapshot(draft.book.id)).rejects.toThrow("asset is invalid");
  });
});
