import {
  articleDisplayTitle,
  browserArticleEditorHref,
  browserArticleHref,
  type BrowserArticle,
} from "./browser-articles";
import { importedDocumentHref, type ImportedDocument } from "./imported-documents";
import { selectRecentInScope, type ReadingEntry } from "./reading-state";

export const DOCUMENT_VISITS_KEY = "verto:document-visits";
export const DOCUMENT_VISITS_CHANGED_EVENT = "verto:document-visits-changed";
const MAX_DOCUMENT_VISITS = 100;

export interface DocumentVisit {
  href: string;
  visitedAt: number;
}

/** Hosts supply source documents they can actually read; the switcher never invents routes. */
export interface SourceSwitcherDocument {
  title: string;
  href: string;
  description?: string;
  tags?: string[];
  section?: string;
  filename?: string;
  path?: string;
  sourceLabel?: string;
  updated?: string;
  date?: string;
  mtime?: number;
  draft?: boolean;
  hidden?: boolean;
}

export interface DocumentSwitcherEntry {
  key: string;
  id?: string;
  title: string;
  href: string;
  readingHref: string;
  filename: string;
  path: string;
  sourceLabel: string;
  kind: "article" | "source" | "pdf" | "epub";
  draft: boolean;
  current: boolean;
  updatedAt: number;
}

/** View and anchors belong to a surface, rather than to the document's identity. */
export function documentSwitcherIdentity(href: string): string {
  try {
    const url = new URL(href, "https://verto.invalid");
    url.searchParams.delete("view");
    url.searchParams.sort();
    return `${url.pathname}${url.search}`;
  } catch {
    return href.split("#", 1)[0];
  }
}

function sourcePath(document: SourceSwitcherDocument): string {
  if (document.path) return document.path;
  try {
    const pathname = new URL(document.href, "https://verto.invalid").pathname;
    return decodeURIComponent(pathname.replace(/^\/read\/?/, ""));
  } catch {
    return document.filename ?? document.section ?? document.title;
  }
}

function pagePath(article: BrowserArticle, byId: Map<string, BrowserArticle>): string {
  const parents: string[] = [];
  const visited = new Set([article.id]);
  let parentId = article.parentId;
  while (parentId && !visited.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    visited.add(parentId);
    parents.unshift(articleDisplayTitle(parent));
    parentId = parent.parentId;
  }
  return [...parents, article.filename].join(" / ");
}

function timestamp(value?: string): number {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildDocumentSwitcherEntries({
  mode,
  articles,
  importedDocuments = [],
  sourceDocuments = [],
  currentId,
  currentHref,
  localSourceLabel = "Browser library",
}: {
  mode: "read" | "edit";
  articles: readonly BrowserArticle[];
  importedDocuments?: readonly ImportedDocument[];
  sourceDocuments?: readonly SourceSwitcherDocument[];
  currentId?: string;
  currentHref?: string;
  localSourceLabel?: string;
}): DocumentSwitcherEntry[] {
  const byId = new Map(articles.map((article) => [article.id, article]));
  const entries: DocumentSwitcherEntry[] = articles.map((article) => ({
    key: `article:${article.id}`,
    id: article.id,
    title: articleDisplayTitle(article),
    href: mode === "edit" ? browserArticleEditorHref(article.id) : browserArticleHref(article.id),
    readingHref: browserArticleHref(article.id),
    filename: article.filename,
    path: pagePath(article, byId),
    sourceLabel: localSourceLabel,
    kind: "article",
    draft: article.status === "draft",
    current: false,
    updatedAt: timestamp(article.updatedAt),
  }));
  if (mode === "read") {
    entries.push(
      ...importedDocuments.map(
        (document): DocumentSwitcherEntry => ({
          key: `file:${document.id}`,
          id: document.id,
          title: document.title,
          href: importedDocumentHref(document.id),
          readingHref: importedDocumentHref(document.id),
          filename: document.filename,
          path: document.filename,
          sourceLabel: localSourceLabel,
          kind: document.format,
          draft: false,
          current: false,
          updatedAt: timestamp(document.updatedAt),
        })
      ),
      ...sourceDocuments
        .filter((document) => !document.hidden)
        .map((document): DocumentSwitcherEntry => {
          const path = sourcePath(document);
          return {
            key: `source:${documentSwitcherIdentity(document.href)}`,
            title: document.title,
            href: document.href,
            readingHref: document.href,
            filename: document.filename ?? path.split("/").at(-1) ?? document.title,
            path,
            sourceLabel: document.sourceLabel ?? "Content source",
            kind: "source",
            draft: document.draft ?? false,
            current: false,
            updatedAt:
              timestamp(document.updated ?? document.date) ||
              (typeof document.mtime === "number" && Number.isFinite(document.mtime)
                ? document.mtime
                : 0),
          };
        })
    );
  }
  const identity = currentHref ? documentSwitcherIdentity(currentHref) : undefined;
  const seen = new Set<string>();
  return entries
    .filter((entry) => {
      const key = documentSwitcherIdentity(entry.readingHref);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((entry) => ({
      ...entry,
      current:
        (!!currentId && entry.id === currentId) ||
        (!!identity &&
          [entry.href, entry.readingHref].some(
            (href) => documentSwitcherIdentity(href) === identity
          )),
    }))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

function searchable(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase();
}

/** Only still-readable history is recent; timestamps used for fallback never claim a visit. */
export function selectDocumentSwitcherResults(
  entries: readonly DocumentSwitcherEntry[],
  query: string,
  visits: readonly DocumentVisit[],
  readingHistory: readonly ReadingEntry[] = []
): { entry: DocumentSwitcherEntry; recent: boolean }[] {
  const words = searchable(query.trim()).split(/\s+/).filter(Boolean);
  if (words.length) {
    return entries
      .filter((entry) => {
        const haystack = searchable(`${entry.title} ${entry.filename} ${entry.path}`);
        return words.every((word) => haystack.includes(word));
      })
      .map((entry) => ({ entry, recent: false }));
  }
  const byHref = new Map(
    entries.map((entry) => [documentSwitcherIdentity(entry.readingHref), entry])
  );
  const reading = selectRecentInScope(
    readingHistory.map((entry) => ({ ...entry, href: documentSwitcherIdentity(entry.href) })),
    byHref.keys()
  );
  const history = normalizeDocumentVisits([
    ...visits,
    ...reading.map((entry) => ({ href: entry.href, visitedAt: timestamp(entry.lastReadAt) })),
  ]);
  const recentEntries = history.flatMap((visit) => {
    const entry = byHref.get(visit.href);
    if (!entry) return [];
    byHref.delete(visit.href);
    return [{ entry, recent: true }];
  });
  return [...recentEntries, ...Array.from(byHref.values(), (entry) => ({ entry, recent: false }))];
}

/** Bounded metadata only: progress and portable source stay in their existing stores. */
export function normalizeDocumentVisits(value: unknown): DocumentVisit[] {
  if (!Array.isArray(value)) return [];
  const latest = new Map<string, number>();
  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.href !== "string" ||
      !/^\/read(?:\/|\?|$)/.test(item.href) ||
      typeof item.visitedAt !== "number" ||
      !Number.isFinite(item.visitedAt) ||
      item.visitedAt <= 0
    )
      continue;
    const href = documentSwitcherIdentity(item.href);
    latest.set(href, Math.max(latest.get(href) ?? 0, item.visitedAt));
  }
  return Array.from(latest, ([href, visitedAt]) => ({ href, visitedAt }))
    .sort((left, right) => right.visitedAt - left.visitedAt)
    .slice(0, MAX_DOCUMENT_VISITS);
}

export function loadDocumentVisits(): DocumentVisit[] {
  if (typeof window === "undefined") return [];
  try {
    return normalizeDocumentVisits(
      JSON.parse(window.localStorage.getItem(DOCUMENT_VISITS_KEY) ?? "[]")
    );
  } catch {
    return [];
  }
}

export function recordDocumentVisit(href: string): void {
  if (typeof window === "undefined") return;
  try {
    const visits = normalizeDocumentVisits([
      { href, visitedAt: Date.now() },
      ...loadDocumentVisits(),
    ]);
    window.localStorage.setItem(DOCUMENT_VISITS_KEY, JSON.stringify(visits));
    window.dispatchEvent(new Event(DOCUMENT_VISITS_CHANGED_EVENT));
  } catch {
    // Reading and switching remain available when local storage is disabled or full.
  }
}

export function subscribeDocumentVisits(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === DOCUMENT_VISITS_KEY) listener();
  };
  window.addEventListener(DOCUMENT_VISITS_CHANGED_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(DOCUMENT_VISITS_CHANGED_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
