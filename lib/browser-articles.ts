import { titleFromFilename } from "./content-source/metadata";
import { isTauri, tauriInvoke } from "./tauri";
import {
  ARTICLE_STORE,
  localDocumentId,
  notifyLocalLibraryChange,
  openLibraryDatabase,
  subscribeLocalLibrary,
  validExpectedRevision,
} from "./local-library-storage";

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
  /** Page name is metadata; renaming never rewrites portable Markdown. */
  title?: string;
  parentId?: string | null;
  order?: number;
}

export type BrowserArticleSaveResult =
  | { status: "saved"; article: BrowserArticle }
  | { status: "conflict"; article: BrowserArticle }
  | { status: "missing" };

export type BrowserArticleDeleteResult =
  | { status: "deleted" | "missing" }
  | { status: "conflict"; article: BrowserArticle }
  | { status: "has-children"; children: BrowserArticle[] };

export type BrowserArticleMetadata = Pick<
  BrowserArticle,
  "title" | "filename" | "parentId" | "order"
>;

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
    (article.originSlug === undefined || typeof article.originSlug === "string") &&
    (article.title === undefined ||
      (typeof article.title === "string" &&
        !!article.title.trim() &&
        article.title.length <= 500)) &&
    (article.parentId === undefined ||
      article.parentId === null ||
      (typeof article.parentId === "string" && !!article.parentId)) &&
    (article.order === undefined || (Number.isFinite(article.order) && (article.order ?? -1) >= 0))
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
    ...(value.title === undefined ? {} : { title: value.title }),
    ...(value.parentId === undefined ? {} : { parentId: value.parentId }),
    ...(value.order === undefined ? {} : { order: value.order }),
  };
}

/** Shared migration validation uses the same whitelist as ordinary article reads. */
export const checkedBrowserArticle = checkedArticle;

/** Build a new unsaved document. Its first successful save returns revision one. */
export function createBrowserArticle(options: {
  filename: string;
  source: string;
  status?: BrowserArticle["status"];
  originSlug?: string;
  title?: string;
  parentId?: string | null;
  order?: number;
}): BrowserArticle {
  const now = new Date().toISOString();
  return checkedArticle({
    ...options,
    id: localDocumentId(),
    createdAt: now,
    updatedAt: now,
    revision: 0,
    status: options.status ?? "draft",
  });
}

async function readRecords<T>(operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openLibraryDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(ARTICLE_STORE, "readonly");
      const request = operation(transaction.objectStore(ARTICLE_STORE));
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
  if (isTauri()) {
    const records = await tauriInvoke<unknown[]>("list_managed_articles");
    return records.map(checkedArticle).sort(sortByUpdated);
  }
  return listArticlesInBrowser();
}

/** Explicit migration reads the old webview store without switching adapters. */
export async function listArticlesInBrowser(): Promise<BrowserArticle[]> {
  const records = await readRecords<unknown[]>((store) => store.getAll());
  return records.map(checkedArticle).sort(sortByUpdated);
}

function sortByUpdated(a: BrowserArticle, b: BrowserArticle): number {
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id);
}

export async function readBrowserArticle(id: string): Promise<BrowserArticle | null> {
  const record = isTauri()
    ? await tauriInvoke<unknown>("read_managed_article", { id })
    : await readRecords<unknown>((store) => store.get(id));
  return record == null ? null : checkedArticle(record);
}

/** A null revision only creates a record; existing records require a matching revision. */
export async function saveBrowserArticle(
  article: BrowserArticle,
  expectedRevision: number | null
): Promise<BrowserArticleSaveResult> {
  const input = checkedArticle(article);
  if (expectedRevision !== null) validExpectedRevision(expectedRevision);
  if (isTauri()) {
    const result = await tauriInvoke<BrowserArticleSaveResult>("save_managed_article", {
      article: input,
      expectedRevision,
    });
    if (result.status !== "missing") checkedArticle(result.article);
    if (result.status === "saved") notifyLocalLibraryChange();
    return result;
  }
  return mutateArticleInBrowser(input.id, expectedRevision, () => input);
}

function assertArticleParent(article: BrowserArticle, records: BrowserArticle[]): void {
  let parentId = article.parentId;
  const visited = new Set([article.id]);
  const map = new Map(records.map((item) => [item.id, item]));
  while (parentId) {
    if (visited.has(parentId)) throw new Error("A page cannot be moved into itself or a subpage.");
    visited.add(parentId);
    const parent = map.get(parentId);
    if (!parent) throw new Error("The parent page no longer exists. Choose another page.");
    parentId = parent.parentId;
  }
}

async function mutateArticleInBrowser(
  id: string,
  expectedRevision: number | null,
  update: (existing: BrowserArticle | null) => BrowserArticle
): Promise<BrowserArticleSaveResult> {
  const database = await openLibraryDatabase();
  let result: BrowserArticleSaveResult;
  try {
    result = await new Promise<BrowserArticleSaveResult>((resolve, reject) => {
      const transaction = database.transaction(ARTICLE_STORE, "readwrite");
      const store = transaction.objectStore(ARTICLE_STORE);
      const request = store.getAll();
      let outcome: BrowserArticleSaveResult;
      request.onsuccess = () => {
        try {
          const records = (request.result as unknown[]).map(checkedArticle);
          const existing = records.find((item) => item.id === id) ?? null;
          if (existing && (expectedRevision === null || existing.revision !== expectedRevision)) {
            outcome = { status: "conflict", article: existing };
          } else if (!existing && expectedRevision !== null) {
            outcome = { status: "missing" };
          } else {
            const input = checkedArticle(update(existing));
            assertArticleParent(input, records);
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
  if (result.status === "saved") notifyLocalLibraryChange();
  return result;
}

/** Metadata and text share one revision, so moving never overwrites newer editor content. */
export async function updateBrowserArticleMetadata(
  id: string,
  changes: Partial<BrowserArticleMetadata>,
  expectedRevision: number
): Promise<BrowserArticleSaveResult> {
  validExpectedRevision(expectedRevision);
  const allowed: Partial<BrowserArticleMetadata> = {};
  for (const key of ["title", "filename", "parentId", "order"] as const) {
    if (Object.prototype.hasOwnProperty.call(changes, key))
      Object.assign(allowed, { [key]: changes[key] });
  }
  if (isTauri()) {
    const result = await tauriInvoke<BrowserArticleSaveResult>("update_managed_article", {
      id,
      changes: allowed,
      expectedRevision,
    });
    if (result.status !== "missing") checkedArticle(result.article);
    if (result.status === "saved") notifyLocalLibraryChange();
    return result;
  }
  return mutateArticleInBrowser(id, expectedRevision, (existing) => ({ ...existing!, ...allowed }));
}

export function renameBrowserArticle(
  id: string,
  title: string,
  expectedRevision: number
): Promise<BrowserArticleSaveResult> {
  return updateBrowserArticleMetadata(id, { title: title.trim() }, expectedRevision);
}

export function moveBrowserArticle(
  id: string,
  parentId: string | null,
  expectedRevision: number,
  order?: number
): Promise<BrowserArticleSaveResult> {
  return updateBrowserArticleMetadata(
    id,
    { parentId, ...(order === undefined ? {} : { order }) },
    expectedRevision
  );
}

/** Delete only a leaf page, after an explicit UI confirmation. */
export async function deleteBrowserArticle(
  id: string,
  expectedRevision: number
): Promise<BrowserArticleDeleteResult> {
  validExpectedRevision(expectedRevision);
  if (isTauri()) {
    const result = await tauriInvoke<BrowserArticleDeleteResult>("delete_managed_article", {
      id,
      expectedRevision,
    });
    if (result.status === "deleted") notifyLocalLibraryChange();
    return result;
  }
  const database = await openLibraryDatabase();
  try {
    const result = await new Promise<BrowserArticleDeleteResult>((resolve, reject) => {
      const transaction = database.transaction(ARTICLE_STORE, "readwrite");
      const store = transaction.objectStore(ARTICLE_STORE);
      const request = store.getAll();
      let outcome: BrowserArticleDeleteResult;
      request.onsuccess = () => {
        try {
          const records = (request.result as unknown[]).map(checkedArticle);
          const article = records.find((item) => item.id === id);
          const children = records.filter((item) => item.parentId === id);
          if (!article) outcome = { status: "missing" };
          else if (article.revision !== expectedRevision) outcome = { status: "conflict", article };
          else if (children.length) outcome = { status: "has-children", children };
          else {
            store.delete(id);
            outcome = { status: "deleted" };
          }
        } catch (error) {
          transaction.abort();
          reject(error);
        }
      };
      transaction.oncomplete = () => resolve(outcome);
      transaction.onabort = transaction.onerror = () =>
        reject(transaction.error ?? new Error("Article storage could not delete."));
    });
    if (result.status === "deleted") notifyLocalLibraryChange();
    return result;
  } finally {
    database.close();
  }
}

export async function findBrowserArticleByOriginSlug(slug: string): Promise<BrowserArticle | null> {
  return (await listBrowserArticles()).find((article) => article.originSlug === slug) ?? null;
}

/** Notify the current window and other same-origin tabs after a committed save. */
export function subscribeBrowserArticles(callback: () => void): () => void {
  return subscribeLocalLibrary(callback);
}

export function articleDisplayTitle(article: BrowserArticle): string {
  return article.title ?? articleTitle(article.source, article.filename);
}

export function articleStorageLabel(): string {
  return isTauri() ? "On this device" : "Saved in this browser";
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
