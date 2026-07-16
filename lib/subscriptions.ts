// Local persistence for RSS feed subscriptions.
//
// A subscription is the runtime, user-added equivalent of a PRD `Source` with
// `kind: "rss"` (see docs/product/ai-native-knowledge-reader-prd.md §7). Unlike
// the build-time `ContentSource` backends (local / onedrive), RSS feeds
// are added and refreshed at runtime, so they live in `localStorage` rather than
// in the static build. This module mirrors `lib/summaries.ts`: a pure,
// dependency-free store with SSR-guarded `localStorage` access and same-tab
// change notifications.
//
// The feed URL is the canonical identity of a subscription — adding the same
// feed twice updates the existing entry instead of duplicating it. Inbox items
// (`lib/inbox.ts`) reference their owning subscription by the same `feedUrl`.

import {
  InboxPersistenceError,
  loadInbox,
  notifyInboxChanged,
  removeInboxItemsByFeed,
  saveInbox,
} from "@/lib/inbox";

/** Maximum number of feed subscriptions to retain. */
export const MAX_SUBSCRIPTIONS = 200;

/** Re-check feeds that have not completed a sync in the last 30 minutes. */
export const SUBSCRIPTION_STALE_AFTER_MS = 30 * 60 * 1000;

/** `localStorage` key for RSS subscriptions. */
export const SUBSCRIPTIONS_KEY = "verto:subscriptions";

export interface Subscription {
  /** Canonical identity: the RSS/Atom feed URL (absolute http/https). */
  feedUrl: string;
  /** Display name for the feed/source. */
  title: string;
  /** Optional homepage link advertised by the feed. */
  siteUrl?: string;
  /** ISO-8601 timestamp of when the feed was subscribed. */
  createdAt: string;
  /** ISO-8601 timestamp of the most recent successful fetch, if any. */
  lastFetchedAt?: string;
  /** ISO-8601 timestamp of the most recent failed fetch, if any. */
  lastSyncErrorAt?: string;
}

export interface SubscriptionsState {
  subscriptions: Subscription[];
}

export class SubscriptionsPersistenceError extends Error {
  constructor() {
    super("Subscription changes could not be saved to local storage.");
    this.name = "SubscriptionsPersistenceError";
  }
}

const EMPTY_SUBSCRIPTIONS_STATE: SubscriptionsState = { subscriptions: [] };

/** Whether Inbox should check a subscription again when the user returns. */
export function isSubscriptionStale(
  subscription: Subscription,
  now: number = Date.now(),
  maxAge: number = SUBSCRIPTION_STALE_AFTER_MS
): boolean {
  if (!subscription.lastFetchedAt) return true;
  const lastFetchedAt = Date.parse(subscription.lastFetchedAt);
  return Number.isNaN(lastFetchedAt) || now - lastFetchedAt >= maxAge;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** True only for absolute `http:` / `https:` URLs. */
function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeSubscription(value: unknown): Subscription | null {
  if (!isRecord(value)) return null;
  // A subscription must point at a real, fetchable feed over http(s); this also
  // rejects `javascript:` and protocol-relative `//host` URLs.
  if (!isHttpUrl(value.feedUrl)) return null;
  if (typeof value.title !== "string" || value.title.trim() === "") return null;

  const createdAt =
    typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString();

  const subscription: Subscription = {
    feedUrl: value.feedUrl,
    title: value.title,
    createdAt,
  };

  if (isHttpUrl(value.siteUrl)) subscription.siteUrl = value.siteUrl;
  if (typeof value.lastFetchedAt === "string") {
    subscription.lastFetchedAt = value.lastFetchedAt;
  }
  if (typeof value.lastSyncErrorAt === "string") {
    subscription.lastSyncErrorAt = value.lastSyncErrorAt;
  }

  return subscription;
}

function normalizeState(value: unknown): SubscriptionsState {
  if (!isRecord(value) || !Array.isArray(value.subscriptions)) {
    return { ...EMPTY_SUBSCRIPTIONS_STATE };
  }

  return {
    subscriptions: value.subscriptions
      .map(normalizeSubscription)
      .filter((item): item is Subscription => item !== null)
      .slice(0, MAX_SUBSCRIPTIONS),
  };
}

export function upsertSubscription(
  list: readonly Subscription[],
  subscription: Subscription,
  max: number = MAX_SUBSCRIPTIONS
): Subscription[] {
  const normalized = normalizeSubscription(subscription);
  if (!normalized) return [...list];

  const deduped = list.filter((item) => item.feedUrl !== normalized.feedUrl);
  return [normalized, ...deduped].slice(0, Math.max(0, max));
}

export function removeSubscription(list: readonly Subscription[], feedUrl: string): Subscription[] {
  return list.filter((item) => item.feedUrl !== feedUrl);
}

export function findSubscription(
  list: readonly Subscription[],
  feedUrl: string
): Subscription | null {
  return list.find((item) => item.feedUrl === feedUrl) ?? null;
}

/** Subscribe to cross-tab and same-tab subscription updates. */
export function subscribeSubscriptions(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

export function loadSubscriptions(): SubscriptionsState {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ...EMPTY_SUBSCRIPTIONS_STATE };
  }

  try {
    const raw = window.localStorage.getItem(SUBSCRIPTIONS_KEY);
    if (!raw) return { ...EMPTY_SUBSCRIPTIONS_STATE };
    return normalizeState(JSON.parse(raw));
  } catch {
    return { ...EMPTY_SUBSCRIPTIONS_STATE };
  }
}

export function saveSubscriptions(state: SubscriptionsState): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;

  try {
    window.localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(normalizeState(state)));
    return true;
  } catch {
    return false;
  }
}

function persistSubscriptions(state: SubscriptionsState): void {
  if (!saveSubscriptions(state)) throw new SubscriptionsPersistenceError();
}

export function saveSubscription(subscription: Subscription): SubscriptionsState {
  const current = loadSubscriptions();
  const next = {
    subscriptions: upsertSubscription(current.subscriptions, subscription),
  };
  persistSubscriptions(next);
  notifySubscriptionsChanged();
  return next;
}

export function deleteSubscription(feedUrl: string): SubscriptionsState {
  const current = loadSubscriptions();
  const next = {
    subscriptions: removeSubscription(current.subscriptions, feedUrl),
  };
  persistSubscriptions(next);
  notifySubscriptionsChanged();
  return next;
}

export interface UnsubscribeResult {
  state: SubscriptionsState;
  removedInboxItems: number;
}

/**
 * Remove a feed and its cached articles as one user operation.
 *
 * localStorage has no transaction primitive, so the subscription snapshot is
 * restored if the second write fails. Notifications are dispatched only after
 * both stores have committed.
 */
export function deleteSubscriptionAndInboxItems(feedUrl: string): UnsubscribeResult {
  const currentSubscriptions = loadSubscriptions();
  const currentInbox = loadInbox();
  const nextSubscriptions = {
    subscriptions: removeSubscription(currentSubscriptions.subscriptions, feedUrl),
  };
  const nextInboxItems = removeInboxItemsByFeed(currentInbox.items, feedUrl);
  const removedInboxItems = currentInbox.items.length - nextInboxItems.length;

  persistSubscriptions(nextSubscriptions);
  if (removedInboxItems > 0 && !saveInbox({ items: nextInboxItems })) {
    saveSubscriptions(currentSubscriptions);
    throw new InboxPersistenceError();
  }

  notifySubscriptionsChanged();
  if (removedInboxItems > 0) notifyInboxChanged();
  return { state: nextSubscriptions, removedInboxItems };
}

/**
 * Record a failed refresh without removing the feed or its previously fetched
 * articles. The marker makes recovery visible across Inbox and Sources until
 * the next successful refresh clears it.
 */
export function markSubscriptionSyncFailure(
  feedUrl: string,
  at: string = new Date().toISOString()
): SubscriptionsState {
  const current = loadSubscriptions();
  if (!current.subscriptions.some((subscription) => subscription.feedUrl === feedUrl)) {
    return current;
  }

  const next = {
    subscriptions: current.subscriptions.map((subscription) =>
      subscription.feedUrl === feedUrl ? { ...subscription, lastSyncErrorAt: at } : subscription
    ),
  };
  persistSubscriptions(next);
  notifySubscriptionsChanged();
  return next;
}

export function notifySubscriptionsChanged(): void {
  if (typeof window === "undefined") return;
  const event =
    typeof StorageEvent === "function"
      ? new StorageEvent("storage", { key: SUBSCRIPTIONS_KEY })
      : new Event("storage");
  window.dispatchEvent(event);
}
