// Fetch a subscribed feed and return the normalized subscription and Inbox items.
//
// Persistence intentionally stays with the caller. This keeps the network and
// parsing boundary deterministic, testable, and safe to reuse from different UI
// entry points such as initial subscribe and manual refresh.

import type { Subscription } from "@/lib/subscriptions";
import type { FetchLike } from "@/lib/tauri";
import { fetchFeed } from "./fetch";
import { parsedFeedToInboxItems } from "./to-inbox";

export interface RefreshSubscriptionOptions {
  /** ISO timestamp used for the subscription and resulting Inbox items. */
  now?: string;
}

export interface RefreshSubscriptionResult {
  subscription: Subscription;
  itemCount: number;
  items: ReturnType<typeof parsedFeedToInboxItems>;
}

/**
 * Fetch a subscription, preferring the feed's display metadata while retaining
 * the locally known values when a feed omits them.
 */
export async function refreshSubscription(
  subscription: Subscription,
  fetchImpl: FetchLike,
  options: RefreshSubscriptionOptions = {}
): Promise<RefreshSubscriptionResult> {
  const feed = await fetchFeed(subscription.feedUrl, fetchImpl);
  const now = options.now ?? new Date().toISOString();
  const items = parsedFeedToInboxItems(feed, subscription.feedUrl, { now });

  return {
    subscription: {
      ...subscription,
      title: feed.title.trim() || subscription.title,
      ...(feed.siteUrl ? { siteUrl: feed.siteUrl } : {}),
      lastFetchedAt: now,
    },
    itemCount: items.length,
    items,
  };
}
