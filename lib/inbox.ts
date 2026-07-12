// Local persistence for normalized Inbox items.
//
// An inbox item is the runtime equivalent of a PRD `ContentItem` with
// `sourceType: "rss"` (see docs/product/ai-native-knowledge-reader-prd.md §7),
// narrowed to the fields the Inbox needs in v0. Items are produced by fetching
// the feeds in `lib/subscriptions.ts` and stored in `localStorage`, mirroring
// the `lib/summaries.ts` pattern: pure transforms plus SSR-guarded persistence
// and same-tab change notifications.
//
// Identity is the feed entry's `id` (its guid or link). Re-fetching a feed
// updates an existing item's content in place while preserving the reader's
// triage `status` and original `createdAt`, so marking something read or
// archived survives the next refresh.

export type InboxStatus = "unread" | "reading" | "read" | "archived";

export const INBOX_STATUSES: readonly InboxStatus[] = ["unread", "reading", "read", "archived"];

function isInboxStatus(value: unknown): value is InboxStatus {
  return typeof value === "string" && (INBOX_STATUSES as readonly string[]).includes(value);
}

export function normalizeInboxStatus(value: unknown): InboxStatus {
  return isInboxStatus(value) ? value : "unread";
}

/** Maximum number of inbox items to retain. */
export const MAX_INBOX_ITEMS = 500;

/** Longest retained plain-text feed body, guarding localStorage quota. */
export const MAX_INBOX_CONTENT_LENGTH = 6_000;

/** `localStorage` key for inbox items. */
export const INBOX_KEY = "verto:inbox";

export interface InboxItem {
  /** Stable dedupe identity: the feed entry's guid or link. */
  id: string;
  /** Feed URL of the owning subscription (`lib/subscriptions.ts`). */
  feedUrl: string;
  /** Display name of the source feed. */
  sourceName: string;
  title: string;
  /** Canonical link to the original article (absolute http/https). */
  url: string;
  author?: string;
  /** ISO-8601 publish timestamp advertised by the feed, if any. */
  publishedAt?: string;
  /** Short plain-text excerpt from the feed entry, if any. */
  summary?: string;
  /** Safe plain-text body captured from the feed for the local preview. */
  content?: string;
  status: InboxStatus;
  /** ISO-8601 timestamp of when the item entered the inbox. */
  createdAt: string;
}

export interface InboxState {
  items: InboxItem[];
}

const EMPTY_INBOX_STATE: InboxState = { items: [] };

/**
 * Number of items that still need attention in the Inbox. Reading is included
 * here because the Inbox's own “Unread” filter groups unread and in-progress
 * articles together.
 */
export function getInboxAttentionCount(items: readonly InboxItem[]): number {
  return items.filter((item) => item.status === "unread" || item.status === "reading").length;
}

/** Subscribe to cross-tab and same-tab Inbox updates. */
export function subscribeInbox(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeInboxItem(value: unknown): InboxItem | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || value.id.trim() === "") return null;
  if (!isHttpUrl(value.feedUrl)) return null;
  if (typeof value.title !== "string" || value.title.trim() === "") return null;
  // An item with no real link can't be opened or de-duplicated reliably; also
  // rejects `javascript:` and protocol-relative `//host` URLs.
  if (!isHttpUrl(value.url)) return null;

  const sourceName = typeof value.sourceName === "string" ? value.sourceName : "";
  const createdAt =
    typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString();

  const item: InboxItem = {
    id: value.id,
    feedUrl: value.feedUrl,
    sourceName,
    title: value.title,
    url: value.url,
    status: normalizeInboxStatus(value.status),
    createdAt,
  };

  if (typeof value.author === "string") item.author = value.author;
  if (typeof value.publishedAt === "string") {
    item.publishedAt = value.publishedAt;
  }
  if (typeof value.summary === "string") item.summary = value.summary;
  if (typeof value.content === "string") {
    const content = value.content.trim().slice(0, MAX_INBOX_CONTENT_LENGTH);
    if (content) item.content = content;
  }

  return item;
}

function normalizeState(value: unknown): InboxState {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return { ...EMPTY_INBOX_STATE };
  }

  return {
    items: value.items
      .map(normalizeInboxItem)
      .filter((item): item is InboxItem => item !== null)
      .slice(0, MAX_INBOX_ITEMS),
  };
}

export function upsertInboxItem(
  list: readonly InboxItem[],
  item: InboxItem,
  max: number = MAX_INBOX_ITEMS
): InboxItem[] {
  const normalized = normalizeInboxItem(item);
  if (!normalized) return [...list];

  const index = list.findIndex((entry) => entry.id === normalized.id);
  if (index >= 0) {
    const existing = list[index];
    const next = [...list];
    next[index] = {
      ...normalized,
      status: existing.status,
      createdAt: existing.createdAt,
    };
    return next;
  }

  return [normalized, ...list].slice(0, Math.max(0, max));
}

export function removeInboxItem(list: readonly InboxItem[], id: string): InboxItem[] {
  return list.filter((item) => item.id !== id);
}

export function findInboxItem(list: readonly InboxItem[], id: string): InboxItem | null {
  return list.find((item) => item.id === id) ?? null;
}

export function setInboxItemStatus(
  list: readonly InboxItem[],
  id: string,
  status: InboxStatus
): InboxItem[] {
  return list.map((item) =>
    item.id === id ? { ...item, status: normalizeInboxStatus(status) } : item
  );
}

export function loadInbox(): InboxState {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ...EMPTY_INBOX_STATE };
  }

  try {
    const raw = window.localStorage.getItem(INBOX_KEY);
    if (!raw) return { ...EMPTY_INBOX_STATE };
    return normalizeState(JSON.parse(raw));
  } catch {
    return { ...EMPTY_INBOX_STATE };
  }
}

export function saveInbox(state: InboxState): void {
  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    window.localStorage.setItem(INBOX_KEY, JSON.stringify(normalizeState(state)));
  } catch {
    // The inbox is a convenience. Disabled or quota-limited storage should
    // never break reading.
  }
}

export function saveInboxItem(item: InboxItem): InboxState {
  const current = loadInbox();
  const next = { items: upsertInboxItem(current.items, item) };
  saveInbox(next);
  notifyInboxChanged();
  return next;
}

export function deleteInboxItem(id: string): InboxState {
  const current = loadInbox();
  const next = { items: removeInboxItem(current.items, id) };
  saveInbox(next);
  notifyInboxChanged();
  return next;
}

export function setInboxStatus(id: string, status: InboxStatus): InboxState {
  const current = loadInbox();
  const next = { items: setInboxItemStatus(current.items, id, status) };
  saveInbox(next);
  notifyInboxChanged();
  return next;
}

export function notifyInboxChanged(): void {
  if (typeof window === "undefined") return;
  const event =
    typeof StorageEvent === "function"
      ? new StorageEvent("storage", { key: INBOX_KEY })
      : new Event("storage");
  window.dispatchEvent(event);
}
