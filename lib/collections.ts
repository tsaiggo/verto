// Local persistence for user-defined collections.
//
// A collection is a named list of document hrefs. Users create, rename, and
// delete collections, and add or remove documents from them.
//
// Reads/writes go through `getStateStore()` (localStorage on web,
// localStorage + .verto/collections.json mirror on desktop). The store name is
// "collections" (→ `verto:collections` in localStorage).

import { getStateStore } from "@/lib/state-store";

export interface Collection {
  id: string;
  name: string;
  docHrefs: string[];
  /** Last known titles, keyed by href, for readable collection details. */
  docTitles?: Record<string, string>;
  /** ISO-8601 timestamp of when the collection was created. */
  createdAt: string;
}

/** The full `verto:collections` localStorage key (used for StorageEvent dispatch). */
export const COLLECTIONS_KEY = "verto:collections";

// `useSyncExternalStore` compares snapshots by reference. Keeping the most
// recent normalized value lets collection consumers re-render only after an
// actual persisted change, instead of looping because JSON reads create a new
// array on every render.
let cachedSerializedCollections: string | null = null;
let cachedCollections: Collection[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeCollection(value: unknown): Collection | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || value.id.trim() === "") return null;
  if (typeof value.name !== "string" || value.name.trim() === "") return null;
  const docTitles = isRecord(value.docTitles)
    ? Object.fromEntries(
        Object.entries(value.docTitles).flatMap(([href, title]) =>
          typeof title === "string" && href.trim() && title.trim() ? [[href, title.trim()]] : []
        )
      )
    : undefined;
  return {
    id: value.id.trim(),
    name: value.name.trim(),
    docHrefs: Array.isArray(value.docHrefs)
      ? value.docHrefs.filter((h): h is string => typeof h === "string" && h.trim() !== "")
      : [],
    ...(docTitles && Object.keys(docTitles).length > 0 ? { docTitles } : {}),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
  };
}

function normalizeCollections(value: unknown): Collection[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeCollection).filter((c): c is Collection => c !== null);
}

/** Load all user-defined collections from the store, normalizing on the way in. */
export function loadCollections(): Collection[] {
  const collections = normalizeCollections(getStateStore().read("collections", []));
  const serialized = JSON.stringify(collections);

  if (serialized === cachedSerializedCollections) return cachedCollections;

  cachedSerializedCollections = serialized;
  cachedCollections = collections;
  return cachedCollections;
}

/** Create a new named collection. Returns the updated list. */
export function createCollection(name: string): Collection[] {
  const trimmed = name.trim();
  if (!trimmed) return loadCollections();
  const newCol: Collection = {
    id: crypto.randomUUID(),
    name: trimmed,
    docHrefs: [],
    createdAt: new Date().toISOString(),
  };
  const next = [newCol, ...loadCollections()];
  getStateStore().write("collections", next);
  return next;
}

/** Rename a collection by id. Returns the updated list. */
export function renameCollection(id: string, name: string): Collection[] {
  const trimmed = name.trim();
  if (!trimmed) return loadCollections();
  const current = loadCollections();
  const next = current.map((c) => (c.id === id ? { ...c, name: trimmed } : c));
  getStateStore().write("collections", next);
  return next;
}

/** Delete a collection by id. Returns the updated list. */
export function deleteCollection(id: string): Collection[] {
  const current = loadCollections();
  const next = current.filter((c) => c.id !== id);
  getStateStore().write("collections", next);
  return next;
}

/**
 * Add a document href to a collection. The optional title preserves a useful
 * label when the source is later unavailable. Returns the updated list.
 */
export function addDocToCollection(id: string, href: string, title?: string): Collection[] {
  const current = loadCollections();
  const trimmedTitle = title?.trim();
  const next = current.map((c) => {
    if (c.id !== id) return c;
    const docHrefs = c.docHrefs.includes(href) ? c.docHrefs : [...c.docHrefs, href];
    if (trimmedTitle && c.docTitles?.[href] !== trimmedTitle) {
      return { ...c, docHrefs, docTitles: { ...c.docTitles, [href]: trimmedTitle } };
    }
    if (docHrefs === c.docHrefs) return c;
    return {
      ...c,
      docHrefs,
    };
  });
  getStateStore().write("collections", next);
  return next;
}

/** Remove a document href from a collection. Returns the updated list. */
export function removeDocFromCollection(id: string, href: string): Collection[] {
  const current = loadCollections();
  const next = current.map((c) => {
    if (c.id !== id) return c;
    const docTitles = c.docTitles
      ? Object.entries(c.docTitles).reduce<Record<string, string>>((titles, [savedHref, title]) => {
          if (savedHref !== href) titles[savedHref] = title;
          return titles;
        }, {})
      : undefined;
    const collection = { ...c };
    delete collection.docTitles;
    return {
      ...collection,
      docHrefs: c.docHrefs.filter((h) => h !== href),
      ...(docTitles && Object.keys(docTitles).length > 0 ? { docTitles } : {}),
    };
  });
  getStateStore().write("collections", next);
  return next;
}

/**
 * Dispatch a same-tab storage event for the collections key, prompting
 * `useSyncExternalStore` subscribers to re-read. The web store's `write()`
 * already fires this automatically; call `notifyCollectionsChanged()` only when
 * a re-render is needed without a data write.
 */
export function notifyCollectionsChanged(): void {
  if (typeof window === "undefined") return;
  const event =
    typeof StorageEvent === "function"
      ? new StorageEvent("storage", { key: COLLECTIONS_KEY })
      : new Event("storage");
  window.dispatchEvent(event);
}

/**
 * Subscribe to any collection change. Returns an unsubscribe function.
 * Compatible with `useSyncExternalStore`.
 */
export function subscribeCollections(callback: () => void): () => void {
  return getStateStore().subscribe(callback);
}
