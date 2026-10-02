import { IDBFactory, IDBObjectStore as FakeObjectStore } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  articleBody,
  articleFormat,
  articleTitle,
  articleDisplayTitle,
  browserArticleEditorHref,
  browserArticleHref,
  createBrowserArticle,
  findBrowserArticleByOriginSlug,
  listBrowserArticles,
  readBrowserArticle,
  saveBrowserArticle,
  subscribeBrowserArticles,
  renameBrowserArticle,
  moveBrowserArticle,
  updateBrowserArticleMetadata,
  deleteBrowserArticle,
  type BrowserArticle,
} from "./browser-articles";

async function persist(source = "# A portable article\n\nBody."): Promise<BrowserArticle> {
  const result = await saveBrowserArticle(
    createBrowserArticle({ filename: "article.mdx", source }),
    null
  );
  if (result.status !== "saved") throw new Error("Fixture could not save.");
  return result.article;
}

async function rawDatabase(version = 3): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("verto.articles", version);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe("browser article storage", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("creates an unsaved document and reopens its exact source after a committed save", async () => {
    const source =
      '\uFEFF---\r\ntitle: "文章"\r\ncustom: value # preserve this\r\n---\r\n\r\n# 文章\r\n\r\n<Component value={2} />\r\n';
    const draft = createBrowserArticle({
      filename: "my-article.MDX",
      source,
      originSlug: "guides/start",
    });
    expect(draft).toMatchObject({ revision: 0, status: "draft", source });
    expect(await readBrowserArticle(draft.id)).toBeNull();
    const result = await saveBrowserArticle(draft, null);
    expect(result.status).toBe("saved");
    if (result.status !== "saved") return;
    expect(result.article).toMatchObject({
      revision: 1,
      source,
      createdAt: draft.createdAt,
      originSlug: "guides/start",
    });
    expect(await readBrowserArticle(draft.id)).toEqual(result.article);
    expect(await findBrowserArticleByOriginSlug("guides/start")).toEqual(result.article);
    expect(await findBrowserArticleByOriginSlug("absent")).toBeNull();
    expect(await listBrowserArticles()).toEqual([result.article]);
  });

  it("advances revision, status, and update time while preserving creation time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T01:00:00Z"));
    const draft = await persist();
    vi.setSystemTime(new Date("2026-10-02T02:00:00Z"));
    const result = await saveBrowserArticle(
      { ...draft, source: "Updated", status: "saved", createdAt: "2000-01-01T00:00:00Z" },
      draft.revision
    );
    expect(result).toEqual({
      status: "saved",
      article: {
        ...draft,
        source: "Updated",
        status: "saved",
        revision: 2,
        updatedAt: "2026-10-02T02:00:00.000Z",
      },
    });
    expect(await readBrowserArticle(draft.id)).toEqual(
      result.status === "saved" ? result.article : null
    );
  });

  it("returns the persisted version for old revisions and duplicate create attempts", async () => {
    const article = await persist();
    const stale = { ...article, source: "Must not overwrite" };
    expect(await saveBrowserArticle(stale, 0)).toEqual({ status: "conflict", article });
    expect(await saveBrowserArticle(stale, null)).toEqual({ status: "conflict", article });
    expect(await readBrowserArticle(article.id)).toEqual(article);
  });

  it("serializes concurrent saves so exactly one writer wins", async () => {
    const original = await persist();
    const results = await Promise.all([
      saveBrowserArticle({ ...original, source: "Window A" }, original.revision),
      saveBrowserArticle({ ...original, source: "Window B" }, original.revision),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(["conflict", "saved"]);
    const winner = results.find((result) => result.status === "saved");
    expect(winner?.status).toBe("saved");
    if (winner?.status !== "saved") return;
    expect(await readBrowserArticle(original.id)).toEqual(winner.article);
    expect(results.find((result) => result.status === "conflict")).toEqual({
      status: "conflict",
      article: winner.article,
    });
  });

  it("returns missing without recreating a disappeared record", async () => {
    const unsaved = createBrowserArticle({ filename: "gone.md", source: "Do not resurrect" });
    expect(await saveBrowserArticle(unsaved, 1)).toEqual({ status: "missing" });
    expect(await readBrowserArticle(unsaved.id)).toBeNull();
    expect(await listBrowserArticles()).toEqual([]);
  });

  it("sorts articles by the latest committed update", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T01:00:00Z"));
    const first = await persist("First");
    vi.setSystemTime(new Date("2026-10-01T02:00:00Z"));
    const second = await persist("Second");
    expect((await listBrowserArticles()).map((article) => article.id)).toEqual([
      second.id,
      first.id,
    ]);
    vi.setSystemTime(new Date("2026-10-01T03:00:00Z"));
    await saveBrowserArticle({ ...first, source: "Updated first" }, first.revision);
    expect((await listBrowserArticles()).map((article) => article.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it("keeps existing content after a storage write fails", async () => {
    const original = await persist();
    vi.spyOn(FakeObjectStore.prototype, "put").mockImplementationOnce(() => {
      throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    });
    await expect(
      saveBrowserArticle({ ...original, source: "Never committed" }, original.revision)
    ).rejects.toThrow("Storage quota exceeded");
    expect(await readBrowserArticle(original.id)).toEqual(original);
  });

  it("reports storage unavailable instead of pretending an empty library or saved draft", async () => {
    const article = createBrowserArticle({ filename: "offline.md", source: "Text to keep" });
    vi.stubGlobal("indexedDB", undefined);
    await expect(listBrowserArticles()).rejects.toThrow("unavailable");
    await expect(readBrowserArticle(article.id)).rejects.toThrow("unavailable");
    await expect(saveBrowserArticle(article, null)).rejects.toThrow("unavailable");
    expect(article.source).toBe("Text to keep");
  });

  it("reports denied database access", async () => {
    vi.spyOn(indexedDB, "open").mockImplementationOnce(() => {
      throw new DOMException("Storage access denied", "SecurityError");
    });
    await expect(listBrowserArticles()).rejects.toThrow("Storage access denied");
  });

  it("reports an unsupported database version instead of hiding its existing documents", async () => {
    await persist();
    const upgraded = await rawDatabase(4);
    upgraded.close();
    await expect(listBrowserArticles()).rejects.toThrow();
  });

  it("reports corrupt stored records and refuses to overwrite them", async () => {
    const original = await persist();
    const database = await rawDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("articles", "readwrite");
      transaction.objectStore("articles").put({ ...original, source: null });
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    await expect(listBrowserArticles()).rejects.toThrow("invalid");
    await expect(readBrowserArticle(original.id)).rejects.toThrow("invalid");
    await expect(
      saveBrowserArticle({ ...original, source: "Overwrite corrupted data" }, original.revision)
    ).rejects.toThrow("invalid");
    await expect(readBrowserArticle(original.id)).rejects.toThrow("invalid");
  });

  it("does not report saved when a database transaction aborts after a write was queued", async () => {
    const original = await persist();
    const put = FakeObjectStore.prototype.put;
    vi.spyOn(FakeObjectStore.prototype, "put").mockImplementationOnce(function (
      this: IDBObjectStore,
      value,
      key
    ) {
      const request = put.call(this, value, key);
      this.transaction.abort();
      return request;
    });
    await expect(
      saveBrowserArticle({ ...original, source: "Uncommitted text" }, original.revision)
    ).rejects.toThrow();
    expect(await readBrowserArticle(original.id)).toEqual(original);
  });

  it("rejects malformed documents and invalid expected revisions before any write", async () => {
    expect(() => createBrowserArticle({ filename: "data.exe", source: "Text" })).toThrow("invalid");
    const article = createBrowserArticle({ filename: "document.md", source: "Text" });
    await expect(saveBrowserArticle(article, -1)).rejects.toThrow("revision");
    await expect(saveBrowserArticle(article, Number.NaN)).rejects.toThrow("revision");
    await expect(saveBrowserArticle({ ...article, revision: -1 }, null)).rejects.toThrow("invalid");
    expect(await listBrowserArticles()).toEqual([]);
  });

  it("upgrades an existing version-one database without rewriting any original article fields", async () => {
    const article = createBrowserArticle({ filename: "original.md", source: "\uFEFF# 原始\r\n" });
    const legacy = { ...article, revision: 4 };
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("verto.articles", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("articles", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("articles", "readwrite");
      transaction.objectStore("articles").add(legacy);
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
    });
    database.close();
    expect(await readBrowserArticle(article.id)).toEqual(legacy);
    const upgraded = await rawDatabase();
    expect(Array.from(upgraded.objectStoreNames)).toEqual([
      "articles",
      "book-assets",
      "document-bytes",
      "documents",
      "mdx-books",
    ]);
    upgraded.close();
  });

  it("renames page metadata without rewriting Markdown or its filename and preserves creation time", async () => {
    const article = await persist("---\ntitle: Original\n---\n# Original\n");
    const renamed = await renameBrowserArticle(article.id, "  新名称  ", article.revision);
    expect(renamed.status).toBe("saved");
    if (renamed.status !== "saved") return;
    expect(renamed.article).toMatchObject({
      title: "新名称",
      filename: article.filename,
      source: article.source,
      revision: 2,
      createdAt: article.createdAt,
    });
    expect(articleDisplayTitle(renamed.article)).toBe("新名称");
    expect(articleDisplayTitle(article)).toBe("Original");
    expect(
      await updateBrowserArticleMetadata(article.id, { title: "Stale rename" }, article.revision)
    ).toEqual({ status: "conflict", article: renamed.article });
  });

  it("creates a child and rejects missing parents, self moves, descendant cycles, and non-leaf deletion", async () => {
    const root = await persist("# Root");
    const childResult = await saveBrowserArticle(
      createBrowserArticle({
        filename: "child.md",
        source: "# Child",
        parentId: root.id,
        order: 2,
      }),
      null
    );
    if (childResult.status !== "saved") throw new Error("child fixture failed");
    const child = childResult.article;
    await expect(moveBrowserArticle(root.id, child.id, root.revision)).rejects.toThrow("subpage");
    await expect(moveBrowserArticle(root.id, root.id, root.revision)).rejects.toThrow("itself");
    await expect(moveBrowserArticle(child.id, "missing-parent", child.revision)).rejects.toThrow(
      "parent"
    );
    expect(await deleteBrowserArticle(root.id, root.revision)).toEqual({
      status: "has-children",
      children: [child],
    });
    const moved = await moveBrowserArticle(child.id, null, child.revision, 3);
    if (moved.status !== "saved") throw new Error("move fixture failed");
    expect(moved.article).toMatchObject({
      source: child.source,
      parentId: null,
      order: 3,
      revision: 2,
    });
    expect(await deleteBrowserArticle(root.id, root.revision)).toEqual({ status: "deleted" });
    expect(await deleteBrowserArticle(root.id, root.revision)).toEqual({ status: "missing" });
    expect(await readBrowserArticle(child.id)).toEqual(moved.article);
  });

  it("serializes opposing moves to prevent a cycle across different concurrently edited pages", async () => {
    const first = await persist("# First");
    const second = await persist("# Second");
    const results = await Promise.allSettled([
      moveBrowserArticle(first.id, second.id, first.revision),
      moveBrowserArticle(second.id, first.id, second.revision),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const records = await listBrowserArticles();
    expect(records.filter((article) => !!article.parentId)).toHaveLength(1);
  });

  it("rejects stale deletion and commits no delete when a transaction aborts", async () => {
    const article = await persist();
    expect(await deleteBrowserArticle(article.id, 0)).toEqual({ status: "conflict", article });
    const remove = FakeObjectStore.prototype.delete;
    vi.spyOn(FakeObjectStore.prototype, "delete").mockImplementationOnce(function (
      this: IDBObjectStore,
      key
    ) {
      const request = remove.call(this, key);
      this.transaction.abort();
      return request;
    });
    await expect(deleteBrowserArticle(article.id, article.revision)).rejects.toThrow();
    expect(await readBrowserArticle(article.id)).toEqual(article);
    await expect(deleteBrowserArticle(article.id, -1)).rejects.toThrow("revision");
    await expect(renameBrowserArticle(article.id, "", article.revision)).rejects.toThrow("invalid");
    await expect(
      updateBrowserArticleMetadata(article.id, { order: Number.NaN }, article.revision)
    ).rejects.toThrow("invalid");
    expect(await updateBrowserArticleMetadata("gone", { title: "No resurrection" }, 1)).toEqual({
      status: "missing",
    });
  });

  it("generates unique IDs on a LAN browser without randomUUID", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes[0] = Math.floor(Math.random() * 256);
        bytes[1] = ++counter;
        return bytes;
      },
    });
    let counter = 0;
    const first = createBrowserArticle({ filename: "one.md", source: "" });
    const second = createBrowserArticle({ filename: "two.md", source: "" });
    expect(first.id).toMatch(/^[a-f0-9]{32}$/);
    expect(second.id).not.toBe(first.id);
  });

  it("also creates non-secret IDs when Web Crypto is completely absent", () => {
    vi.stubGlobal("crypto", undefined);
    const first = createBrowserArticle({ filename: "one.md", source: "" });
    const second = createBrowserArticle({ filename: "two.md", source: "" });
    expect(first.id).toMatch(/^article-/);
    expect(second.id).not.toBe(first.id);
  });

  it("does not touch window during server rendering", () => {
    vi.stubGlobal("window", undefined);
    const callback = vi.fn();
    expect(() => subscribeBrowserArticles(callback)()).not.toThrow();
    expect(callback).not.toHaveBeenCalled();
  });

  it("notifies only committed saves and cleans up current-window subscriptions", async () => {
    const target = new EventTarget();
    const setItem = vi.fn();
    vi.stubGlobal("window", Object.assign(target, { localStorage: { setItem } }));
    vi.stubGlobal("BroadcastChannel", undefined);
    const listener = vi.fn();
    const unsubscribe = subscribeBrowserArticles(listener);
    const original = await persist();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith("verto.articles.changed", expect.any(String));
    await saveBrowserArticle({ ...original, source: "Conflict" }, 0);
    expect(listener).toHaveBeenCalledTimes(1);
    const unrelated = Object.assign(new Event("storage"), { key: "other.setting" });
    target.dispatchEvent(unrelated);
    expect(listener).toHaveBeenCalledTimes(1);
    target.dispatchEvent(Object.assign(new Event("storage"), { key: "verto.articles.changed" }));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    await saveBrowserArticle({ ...original, source: "Committed" }, original.revision);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("never converts a committed save into failure when notification storage is blocked", async () => {
    const target = new EventTarget();
    Object.defineProperty(target, "localStorage", {
      get() {
        throw new Error("Blocked");
      },
    });
    vi.stubGlobal("window", target);
    vi.stubGlobal("BroadcastChannel", undefined);
    const saved = await persist("Committed text");
    expect((await readBrowserArticle(saved.id))?.source).toBe("Committed text");
  });

  it("subscribes to cross-window messages and closes the channel on cleanup", () => {
    class Channel {
      static instances: Channel[] = [];
      onmessage?: () => void;
      close = vi.fn();
      constructor() {
        Channel.instances.push(this);
      }
    }
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("BroadcastChannel", Channel);
    const listener = vi.fn();
    const unsubscribe = subscribeBrowserArticles(listener);
    Channel.instances[0].onmessage?.();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(Channel.instances[0].close).toHaveBeenCalledOnce();
  });

  it("publishes a cross-window notification only after successful persistence", async () => {
    class Channel {
      static instances: Channel[] = [];
      postMessage = vi.fn();
      close = vi.fn();
      constructor() {
        Channel.instances.push(this);
      }
    }
    vi.stubGlobal(
      "window",
      Object.assign(new EventTarget(), { localStorage: { setItem: vi.fn() } })
    );
    vi.stubGlobal("BroadcastChannel", Channel);
    const saved = await persist();
    expect(await readBrowserArticle(saved.id)).toEqual(saved);
    expect(Channel.instances[0].postMessage).toHaveBeenCalledWith("changed");
    expect(Channel.instances[0].close).toHaveBeenCalledOnce();
  });
});

describe("browser-safe article metadata", () => {
  it("reads title and body while preserving the original source", () => {
    const source =
      '\uFEFF---\r\ntitle: "Notes # 2" # comment\r\ntags: [reading]\r\n---\r\n\r\n# A different H1\r\n\r\nBody.\r\n';
    expect(articleTitle(source, "fallback.md")).toBe("Notes # 2");
    expect(articleBody(source)).toBe("\r\n# A different H1\r\n\r\nBody.\r\n");
    expect(source).toContain('title: "Notes # 2" # comment');
  });

  it("handles simple, single-quoted, folded and literal string titles", () => {
    expect(articleTitle("---\ntitle: 2026 reading # comment\n---\n", "article.md")).toBe(
      "2026 reading"
    );
    expect(articleTitle("---\ntitle: 'Reader''s notes'\n---\n", "article.md")).toBe(
      "Reader's notes"
    );
    expect(
      articleTitle("---\ntitle: >-\n  A longer\n  article title\ntags: [a]\n---\n", "article.md")
    ).toBe("A longer article title");
    expect(articleTitle("---\ntitle: |\n  First line\n  Second line\n---\n", "article.md")).toBe(
      "First line\nSecond line"
    );
  });

  it("ignores non-string and tagged metadata without evaluating it", () => {
    for (const title of [
      "42",
      "true",
      "null",
      "[x, y]",
      "{key: value}",
      "!!js/function '() => malicious()'",
      '"unterminated',
    ]) {
      expect(articleTitle(`---\ntitle: ${title}\n---\n# Body title\n`, "fallback.md")).toBe(
        "Body title"
      );
    }
  });

  it("falls back to the first real H1 outside backtick and tilde code fences", () => {
    const source =
      "```md\n# Inside code\n```\n\n~~~md\n# Also code\n~~~\n\n# Reading notes ###\n\nBody.";
    expect(articleTitle(source, "fallback.md")).toBe("Reading notes");
    expect(articleBody(source)).toBe(source);
    expect(articleTitle("No heading", "my_reading-notes.MDX")).toBe("My Reading Notes");
    expect(articleTitle("No heading", "folder/reading-notes.md")).toBe("Reading Notes");
    expect(articleTitle("", ".md")).toBe("Untitled article");
  });

  it("only removes closed frontmatter at the start of the document", () => {
    const unclosed = "---\ntitle: Keep me\n\n# Article\nBody";
    expect(articleBody(unclosed)).toBe(unclosed);
    const later = "# Heading\n\n---\ntitle: Not frontmatter\n---\n";
    expect(articleBody(later)).toBe(later);
    expect(articleBody("---\ntitle: Article\n...\nBody")).toBe("Body");
    expect(articleBody("---\n---\nBody")).toBe("Body");
  });

  it("encodes document IDs in routes and reports the file format", () => {
    expect(browserArticleHref("a /?b")).toBe("/read/local?document=a%20%2F%3Fb");
    expect(browserArticleEditorHref("a /?b")).toBe("/editor?document=a%20%2F%3Fb");
    expect(articleFormat("article.MDX")).toBe("mdx");
    expect(articleFormat("article.md")).toBe("md");
  });
});
