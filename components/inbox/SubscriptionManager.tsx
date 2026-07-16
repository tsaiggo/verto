"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import SubscriptionDeleteDialog, {
  type SubscriptionRemovalTarget,
} from "@/components/inbox/SubscriptionDeleteDialog";
import SubscriptionPanel from "@/components/inbox/SubscriptionPanel";
import { syncSubscriptions, type SyncedSubscription } from "@/lib/feeds/sync";
import { countInboxItemsByFeed, loadInbox } from "@/lib/inbox";
import {
  deleteSubscriptionAndInboxItems,
  isSubscriptionStale,
  loadSubscriptions,
  markSubscriptionSyncFailure,
  saveSubscription,
  subscribeSubscriptions,
  type Subscription,
  type SubscriptionsState,
} from "@/lib/subscriptions";
import { tauriFetch } from "@/lib/tauri";

type SyncResults = PromiseSettledResult<SyncedSubscription>[];

function getSnapshot() {
  return JSON.stringify(loadSubscriptions());
}

function getServerSnapshot() {
  return JSON.stringify({ subscriptions: [] });
}

function isValidFeedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function articlesLabel(count: number): string {
  return `${count} new ${count === 1 ? "article" : "articles"} added to Inbox`;
}

function getSyncStats(results: SyncResults) {
  const completed = results.filter(
    (result): result is PromiseFulfilledResult<SyncedSubscription> => result.status === "fulfilled"
  );
  return {
    completed,
    failedCount: results.length - completed.length,
    addedCount: completed.reduce((total, result) => total + result.value.addedCount, 0),
  };
}

function syncNotice(results: SyncResults): string {
  const { completed, failedCount } = getSyncStats(results);
  if (failedCount > 0) return `Could not check ${failedCount} feed${failedCount === 1 ? "" : "s"}.`;
  return `Checked ${completed.length} feed${completed.length === 1 ? "" : "s"} just now.`;
}

function useFeedSync() {
  const [refreshingFeedUrls, setRefreshingFeedUrls] = useState<Set<string>>(new Set());
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const isSyncing = refreshingFeedUrls.size > 0;

  const syncFeeds = useCallback(async (targets: readonly Subscription[], bulk: boolean) => {
    if (targets.length === 0) return [];
    const feedUrls = targets.map((subscription) => subscription.feedUrl);
    if (bulk) setIsSyncingAll(true);
    setRefreshingFeedUrls((current) => new Set([...current, ...feedUrls]));
    try {
      const fetchImpl = await tauriFetch();
      return await syncSubscriptions(targets, fetchImpl);
    } catch (error) {
      targets.forEach((subscription) => markSubscriptionSyncFailure(subscription.feedUrl));
      throw error;
    } finally {
      setRefreshingFeedUrls((current) => {
        const next = new Set(current);
        feedUrls.forEach((feedUrl) => next.delete(feedUrl));
        return next;
      });
      if (bulk) setIsSyncingAll(false);
    }
  }, []);

  return { refreshingFeedUrls, isSyncingAll, isSyncing, syncFeeds };
}

function useSubscriptionRemoval(isSyncing: boolean) {
  const [target, setTarget] = useState<SubscriptionRemovalTarget | null>(null);
  const request = useCallback(
    (subscription: Subscription) => {
      if (isSyncing) return;
      setTarget({
        subscription,
        cachedArticleCount: countInboxItemsByFeed(loadInbox().items, subscription.feedUrl),
      });
    },
    [isSyncing]
  );
  const cancel = useCallback(() => setTarget(null), []);
  const confirm = useCallback(() => {
    if (!target) return;
    const { subscription } = target;
    try {
      const result = deleteSubscriptionAndInboxItems(subscription.feedUrl);
      setTarget(null);
      toast.success("Removed subscription", {
        description:
          result.removedInboxItems > 0
            ? `${subscription.title}. Removed ${result.removedInboxItems} cached ${result.removedInboxItems === 1 ? "article" : "articles"}.`
            : subscription.title,
      });
    } catch {
      toast.error("Couldn't remove this subscription", {
        description: "No removal was confirmed. Check local storage and try again.",
      });
    }
  }, [target]);

  return { target, request, cancel, confirm };
}

export default function SubscriptionManager() {
  const snapshot = useSyncExternalStore(subscribeSubscriptions, getSnapshot, getServerSnapshot);
  const subscriptions = (JSON.parse(snapshot) as SubscriptionsState).subscriptions;
  const [url, setUrl] = useState("");
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const { refreshingFeedUrls, isSyncingAll, isSyncing, syncFeeds } = useFeedSync();
  const removal = useSubscriptionRemoval(isSyncing);

  useEffect(() => {
    const staleSubscriptions = loadSubscriptions().subscriptions.filter((subscription) =>
      isSubscriptionStale(subscription)
    );
    if (staleSubscriptions.length === 0) return;

    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      void syncFeeds(staleSubscriptions, true)
        .then((results) => {
          if (!cancelled) setSyncStatus(syncNotice(results));
        })
        .catch(() => {
          if (!cancelled) setSyncStatus("Could not check saved feeds. Use Sync feeds to retry.");
        });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [syncFeeds]);

  async function onAdd() {
    if (isSyncing) return;
    const value = url.trim();
    if (!isValidFeedUrl(value)) {
      toast.error("Enter a valid http(s) feed URL");
      return;
    }

    const existing = subscriptions.find((subscription) => subscription.feedUrl === value);
    const subscription = existing ?? {
      feedUrl: value,
      title: new URL(value).hostname,
      createdAt: new Date().toISOString(),
    };
    if (!existing) {
      try {
        saveSubscription(subscription);
      } catch {
        toast.error("Couldn't save this subscription", {
          description: "Check that local storage is available, then retry.",
        });
        return;
      }
    }
    setUrl("");

    try {
      const [result] = await syncFeeds([subscription], false);
      if (!result || result.status === "rejected") throw result?.reason;
      const { addedCount, subscription: synced } = result.value;
      setSyncStatus(syncNotice([result]));
      toast.success(existing ? `Synced ${synced.title}` : `Subscribed to ${synced.title}`, {
        description: addedCount > 0 ? articlesLabel(addedCount) : "No new articles were found.",
      });
    } catch {
      setSyncStatus("Could not check this feed. Use Sync feeds to retry.");
      toast.error(
        existing
          ? `Couldn't refresh ${subscription.title}`
          : "Subscription saved, but couldn't fetch it",
        { description: "Check the feed URL, then use Refresh to try again." }
      );
    }
  }

  async function onRefresh(subscription: Subscription) {
    if (isSyncing) return;
    try {
      const [result] = await syncFeeds([subscription], false);
      if (!result || result.status === "rejected") throw result?.reason;
      const { addedCount, subscription: synced } = result.value;
      setSyncStatus(syncNotice([result]));
      toast.success(`Synced ${synced.title}`, {
        description: addedCount > 0 ? articlesLabel(addedCount) : "No new articles were found.",
      });
    } catch {
      setSyncStatus("Could not check this feed. Use Sync feeds to retry.");
      toast.error(`Couldn't refresh ${subscription.title}`, {
        description: "Check the feed URL, then try again.",
      });
    }
  }

  async function onSyncAll() {
    if (isSyncing) return;
    setSyncStatus(`Checking ${subscriptions.length} saved feeds…`);
    try {
      const results = await syncFeeds(subscriptions, true);
      const { completed, failedCount, addedCount } = getSyncStats(results);
      setSyncStatus(syncNotice(results));
      if (completed.length > 0) {
        toast.success(`Synced ${completed.length} feed${completed.length === 1 ? "" : "s"}`, {
          description: addedCount > 0 ? articlesLabel(addedCount) : "No new articles were found.",
        });
      }
      if (failedCount > 0) {
        toast.error(`Couldn't sync ${failedCount} feed${failedCount === 1 ? "" : "s"}`, {
          description: "Use the refresh button beside a feed to try again.",
        });
      }
    } catch {
      setSyncStatus("Could not check saved feeds. Use Sync feeds to retry.");
      toast.error("Couldn't sync feeds", { description: "Try again in a moment." });
    }
  }

  return (
    <>
      <SubscriptionPanel
        subscriptions={subscriptions}
        url={url}
        isSyncing={isSyncing}
        isSyncingAll={isSyncingAll}
        refreshingFeedUrls={refreshingFeedUrls}
        syncStatus={syncStatus}
        onUrlChange={setUrl}
        onAdd={() => void onAdd()}
        onRefresh={(subscription) => void onRefresh(subscription)}
        onRemove={removal.request}
        onSyncAll={() => void onSyncAll()}
      />
      <SubscriptionDeleteDialog
        target={removal.target}
        onCancel={removal.cancel}
        onConfirm={removal.confirm}
      />
    </>
  );
}
