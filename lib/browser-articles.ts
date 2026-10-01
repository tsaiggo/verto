import { titleFromFilename } from "./content-source/metadata";

/** Articles stored in this browser profile and origin, with their exact portable source. */
export interface BrowserArticle {
  id: string;
  filename: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  status: "draft" | "saved";
  originSlug?: string;
}

export type BrowserArticleSaveResult =
  | { status: "saved"; article: BrowserArticle }
  | { status: "conflict"; article: BrowserArticle }
  | { status: "missing" };

const DATABASE_NAME = "verto.articles";
const STORE_NAME = "articles";
const CHANGE_EVENT = "verto:articles-changed";
const CHANGE_STORAGE_KEY = "verto.articles.changed";
let fallbackId = 0;

function articleId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return crypto.randomUUID();
  // getRandomValues is also available on ordinary LAN HTTP origins.
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `article-${Date.now().toString(36)}-${++fallbackId}-${Math.random().toString(36).slice(2)}`;
}

function validArticle(value: unknown): value is BrowserArticle {
  if (!value || typeof value !== "object") return false;
  const article = value as Partial<BrowserArticle>;
  return (
    validArticleFields(article) &&
    Number.isFinite(Date.parse(article.createdAt as string)) &&
    Number.isFinite(Date.parse(article.updatedAt as string)) &&
    Number.isSafeInteger(article.revision) &&
    (article.revision ?? -1) >= 0 &&
    (article.status === "draft" || article.status === "saved")
  );
}

function validArticleFields(article: Partial<BrowserArticle>): boolean {
  return (
    typeof article.id === "string" &&
    !!article.id &&
    typeof article.filename === "string" &&
    /\.(md|mdx)$/i.test(article.filename) &&
    typeof article.source === "string" &&
    typeof article.createdAt === "string" &&
    typeof article.updatedAt === "string" &&
    (article.originSlug === undefined || typeof article.originSlug === "string")
  );
}

function checkedArticle(value: unknown): BrowserArticle {
  if (!validArticle(value)) throw new Error("An article in browser storage is invalid.");
  // Persist only document fields, even if an editor supplies incidental UI state.
  return {
    id: value.id,
    filename: value.filename,
    source: value.source,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    revision: value.revision,
    status: value.status,
    ...(value.originSlug === undefined ? {} : { originSlug: value.originSlug }),
  };
}

/** Build a new unsaved document. Its first successful save returns revision one. */
export function createBrowserArticle(options: {
  filename: string;
  source: string;
  status?: BrowserArticle["status"];
  originSlug?: string;
}): BrowserArticle {
  const now = new Date().toISOString();
  return checkedArticle({
    ...options,
    id: articleId(),
    createdAt: now,
    updatedAt: now,
    revision: 0,
    status: options.status ?? "draft",
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof globalThis.indexedDB === "undefined") {
      reject(new Error("Browser article storage is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error("Article storage could not open."));
    request.onblocked = () => {
      blocked = true;
      reject(
        new Error("Article storage is blocked by another browser window. Close it and retry.")
      );
    };
  });
}

async function readRecords<T>(operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = operation(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Article storage could not read."));
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Article storage could not read."));
    });
  } finally {
    database.close();
  }
}

export async function listBrowserArticles(): Promise<BrowserArticle[]> {
  const records = await readRecords<unknown[]>((store) => store.getAll());
  return records.map(checkedArticle).sort((a, b) => {
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id);
  });
}

export async function readBrowserArticle(id: string): Promise<BrowserArticle | null> {
  const record = await readRecords<unknown>((store) => store.get(id));
  return record === undefined ? null : checkedArticle(record);
}

/** A null revision only creates a record; existing records require a matching revision. */
export async function saveBrowserArticle(
  article: BrowserArticle,
  expectedRevision: number | null
): Promise<BrowserArticleSaveResult> {
  const input = checkedArticle(article);
  if (
    expectedRevision !== null &&
    (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
  ) {
    throw new Error("A valid expected article revision is required.");
  }
  const database = await openDatabase();
  let result: BrowserArticleSaveResult;
  try {
    result = await new Promise<BrowserArticleSaveResult>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(input.id);
      let outcome: BrowserArticleSaveResult;
      request.onsuccess = () => {
        try {
          const existing = request.result === undefined ? null : checkedArticle(request.result);
          if (existing && (expectedRevision === null || existing.revision !== expectedRevision)) {
            outcome = { status: "conflict", article: existing };
          } else if (!existing && expectedRevision !== null) {
            outcome = { status: "missing" };
          } else {
            const saved: BrowserArticle = {
              ...input,
              createdAt: existing?.createdAt ?? input.createdAt,
              updatedAt: new Date().toISOString(),
              revision: (existing?.revision ?? 0) + 1,
            };
            store.put(saved);
            outcome = { status: "saved", article: saved };
          }
        } catch (error) {
          transaction.abort();
          reject(error);
        }
      };
      transaction.oncomplete = () => resolve(outcome);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Article storage could not save."));
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Article storage could not save."));
    });
  } finally {
    database.close();
  }
  if (result.status === "saved") notifyArticleChange();
  return result;
}

export async function findBrowserArticleByOriginSlug(slug: string): Promise<BrowserArticle | null> {
  return (await listBrowserArticles()).find((article) => article.originSlug === slug) ?? null;
}

function notifyArticleChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CHANGE_EVENT));
  try {
    const channel = new BroadcastChannel(CHANGE_EVENT);
    channel.postMessage("changed");
    channel.close();
  } catch {
    // Same-window notification remains available when cross-window messaging is blocked.
  }
  try {
    window.localStorage.setItem(CHANGE_STORAGE_KEY, articleId());
  } catch {
    // Notification failure must never make a committed save appear to have failed.
  }
}

/** Notify the current window and other same-origin tabs after a committed save. */
export function subscribeBrowserArticles(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const refresh = () => callback();
  const storage = (event: StorageEvent) => {
    if (event.key === CHANGE_STORAGE_KEY || event.key === null) refresh();
  };
  let channel: BroadcastChannel | undefined;
  try {
    channel = new BroadcastChannel(CHANGE_EVENT);
    channel.onmessage = refresh;
  } catch {
    // storage events provide a fallback on browsers without BroadcastChannel.
  }
  window.addEventListener(CHANGE_EVENT, refresh);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, refresh);
    window.removeEventListener("storage", storage);
    channel?.close();
  };
}

export function browserArticleHref(id: string): string {
  return `/read/local?document=${encodeURIComponent(id)}`;
}

export function browserArticleEditorHref(id: string): string {
  return `/editor?document=${encodeURIComponent(id)}`;
}

export function articleFormat(filename: string): "md" | "mdx" {
  return /\.mdx$/i.test(filename) ? "mdx" : "md";
}

interface ArticleParts {
  header: string | null;
  body: string;
}

function articleParts(source: string): ArticleParts {
  const opener = /^(?:\uFEFF)?---[ \t]*\r?\n/.exec(source);
  if (!opener) return { header: null, body: source };
  const remainder = source.slice(opener[0].length);
  const closing = /^(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/m.exec(remainder);
  return closing
    ? {
        header: remainder.slice(0, closing.index),
        body: remainder.slice(closing.index + closing[0].length),
      }
    : { header: null, body: source };
}

/** Strip a closed YAML header for rendering without modifying the stored source. */
export function articleBody(source: string): string {
  return articleParts(source).body;
}

function scalarTitle(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith('"')) {
    try {
      const quoted = /^("(?:[^"\\]|\\.)*")(?:\s+#.*)?$/.exec(trimmed)?.[1];
      if (!quoted) return null;
      const parsed = JSON.parse(quoted);
      return typeof parsed === "string" ? parsed.trim() || null : null;
    } catch {
      return null;
    }
  }
  if (trimmed.startsWith("'")) {
    const match = /^'((?:[^']|'')*)'(?:\s+#.*)?$/.exec(trimmed);
    return match?.[1].replace(/''/g, "'").trim() || null;
  }
  const plain = trimmed.replace(/\s+#.*$/, "").trim();
  if (
    !plain ||
    /^[\[\]{}&*!]/.test(plain) ||
    /^(?:null|true|false|~|[-+]?\d+(?:\.\d+)?)$/i.test(plain)
  )
    return null;
  return plain;
}

function titleInHeader(header: string | null): string | null {
  if (!header) return null;
  const lines = header.split(/\r?\n/);
  let title: string | null = null;
  for (let index = 0; index < lines.length; index++) {
    const match = /^(?:title|'title'|"title")[ \t]*:[ \t]*(.*)$/.exec(lines[index]);
    if (!match) continue;
    if (/^[>|][+-]?(?:[ \t]+#.*)?$/.test(match[1])) {
      const block: string[] = [];
      while (
        index + 1 < lines.length &&
        (/^[ \t]/.test(lines[index + 1]) || !lines[index + 1].trim())
      ) {
        block.push(lines[++index].trim());
      }
      title = block.join(match[1][0] === ">" ? " " : "\n").trim() || null;
    } else {
      title = scalarTitle(match[1]);
    }
  }
  return title;
}

function headingTitle(body: string): string | null {
  let fence: string | null = null;
  for (const line of body.split(/\r?\n/)) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    const heading = /^\s{0,3}#[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/.exec(line)?.[1];
    if (heading) return heading.trim();
  }
  return null;
}

/** Inspect safe string metadata, then the first H1, then a readable filename. */
export function articleTitle(source: string, filename: string): string {
  const { header, body } = articleParts(source);
  return (
    titleInHeader(header) ||
    headingTitle(body) ||
    titleFromFilename((filename.split(/[\\/]/).at(-1) ?? filename).replace(/\.(md|mdx)$/i, "")) ||
    "Untitled article"
  );
}
