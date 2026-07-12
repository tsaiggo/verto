// Persist refreshed feeds into the local subscription and Inbox stores.
//
// Network and parse work lives in `refresh.ts`; this layer deliberately owns
// only the client-side persistence and bounded batch orchestration used by the
// Inbox UI.

import { loadInbox, saveInboxItem } from "@/lib/inbox";
import { saveSubscription, type Subscription } from "@/lib/subscriptions";
import type { FetchLike } from "@/lib/tauri";
import { refreshSubscription } from "./refresh";

/** A modest cap keeps a large feed list from flooding the user's connection. */
export const FEED_SYNC_CONCURRENCY = 4;

export interface SyncedSubscription {
  subscription: Subscription;
  addedCount: number;
}

export interface SyncSubscriptionsOptions {
  concurrency?: number;
}

function persistRefreshedSubscription(
  refreshed: Awaited<ReturnType<typeof refreshSubscription>>,
  knownItemIds: Set<string>
): SyncedSubscription {
  let addedCount = 0;
  saveSubscription(refreshed.subscription);

  for (const item of refreshed.items) {
    if (!knownItemIds.has(item.id)) {
      knownItemIds.add(item.id);
      addedCount += 1;
    }
    saveInboxItem(item);
  }

  return { subscription: refreshed.subscription, addedCount };
}

/**
 * Refresh subscriptions with a small concurrency cap. A failed feed is kept
 * as a rejected result so the rest of the user's Inbox can still update.
 */
export async function syncSubscriptions(
  subscriptions: readonly Subscription[],
  fetchImpl: FetchLike,
  options: SyncSubscriptionsOptions = {}
): Promise<PromiseSettledResult<SyncedSubscription>[]> {
  if (subscriptions.length === 0) return [];

  const results: PromiseSettledResult<SyncedSubscription>[] = new Array(subscriptions.length);
  const knownItemIds = new Set(loadInbox().items.map((item) => item.id));
  const concurrency = Math.min(
    Math.max(1, options.concurrency ?? FEED_SYNC_CONCURRENCY),
    subscriptions.length
  );
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < subscriptions.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        const refreshed = await refreshSubscription(subscriptions[index], fetchImpl);
        results[index] = {
          status: "fulfilled",
          value: persistRefreshedSubscription(refreshed, knownItemIds),
        };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
