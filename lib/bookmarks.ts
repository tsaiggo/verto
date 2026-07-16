// Local persistence for bookmarks.
//
// A bookmark records the reader's intent to return to a document. Identity is
// the document's `href`. Toggling an already-bookmarked href removes it;
// toggling an unknown href adds it at the front of the list.
//
// Reads/writes go through `getStateStore()` (localStorage on web,
// localStorage + .verto/bookmarks.json mirror on desktop). The store name is
// "bookmarks" (→ `verto:bookmarks` in localStorage).

import { getStateStore } from "@/lib/state-store";

export type BookmarkKind = "document" | "note";

const BOOKMARK_KINDS: readonly BookmarkKind[] = ["document", "note"];

export interface Bookmark {
  href: string;
  title: string;
  kind: BookmarkKind;
  /** ISO-8601 timestamp of when the bookmark was added. */
  addedAt: string;
}

/** The full `verto:bookmarks` localStorage key (used for StorageEvent dispatch). */
export const BOOKMARKS_KEY = "verto:bookmarks";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBookmarkKind(value: unknown): value is BookmarkKind {
  return typeof value === "string" && (BOOKMARK_KINDS as readonly string[]).includes(value);
}

function normalizeBookmark(value: unknown): Bookmark | null {
  if (!isRecord(value)) return null;
  if (typeof value.href !== "string" || value.href.trim() === "") return null;
  if (typeof value.title !== "string" || value.title.trim() === "") return null;
  return {
    href: value.href.trim(),
    title: value.title.trim(),
    kind: isBookmarkKind(value.kind) ? value.kind : "document",
    addedAt: typeof value.addedAt === "string" ? value.addedAt : new Date(0).toISOString(),
  };
}

function normalizeBookmarks(value: unknown): Bookmark[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeBookmark).filter((b): b is Bookmark => b !== null);
}

/** Load all bookmarks from the store, normalizing on the way in. */
export function loadBookmarks(): Bookmark[] {
  return normalizeBookmarks(getStateStore().read("bookmarks", []));
}

/** Returns true if the given href is currently bookmarked. */
export function isBookmarked(href: string): boolean {
  return loadBookmarks().some((b) => b.href === href);
}

/**
 * Add or remove a bookmark (toggle). Returns the updated list.
 * If the href is already bookmarked, removes it; otherwise prepends it.
 */
export async function toggleBookmark(item: Bookmark): Promise<Bookmark[]> {
  return getStateStore().update<Bookmark[]>("bookmarks", [], (value) => {
    const current = normalizeBookmarks(value);
    const exists = current.some((bookmark) => bookmark.href === item.href);
    return exists ? current.filter((bookmark) => bookmark.href !== item.href) : [item, ...current];
  });
}

/** Remove a bookmark by href. Returns the updated list. */
export async function removeBookmark(href: string): Promise<Bookmark[]> {
  return getStateStore().update<Bookmark[]>("bookmarks", [], (value) =>
    normalizeBookmarks(value).filter((bookmark) => bookmark.href !== href)
  );
}

/**
 * Dispatch a same-tab storage event for the bookmarks key, prompting
 * `useSyncExternalStore` subscribers to re-read. The web store's `write()`
 * already fires this automatically; call `notifyBookmarksChanged()` only when
 * a re-render is needed without a data write.
 */
export function notifyBookmarksChanged(): void {
  if (typeof window === "undefined") return;
  const event =
    typeof StorageEvent === "function"
      ? new StorageEvent("storage", { key: BOOKMARKS_KEY })
      : new Event("storage");
  window.dispatchEvent(event);
}

/**
 * Subscribe to any bookmark change. Returns an unsubscribe function.
 * Compatible with `useSyncExternalStore`.
 */
export function subscribeBookmarks(callback: () => void): () => void {
  return getStateStore().subscribe(callback);
}

/** Format a bookmark timestamp without ever exposing `Invalid Date`. */
export function formatBookmarkAge(iso: string, now: number = Date.now()): string {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return "Date unavailable";

  const diff = Math.max(0, now - timestamp);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
