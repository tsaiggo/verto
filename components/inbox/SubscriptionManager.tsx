"use client";

import { LoaderCircle, Plus, RefreshCw, Rss, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { syncSubscriptions, type SyncedSubscription } from "@/lib/feeds/sync";
import {
  deleteSubscription,
  isSubscriptionStale,
  loadSubscriptions,
  markSubscriptionSyncFailure,
  saveSubscription,
  subscribeSubscriptions,
  type Subscription,
  type SubscriptionsState,
} from "@/lib/subscriptions";
import { tauriFetch } from "@/lib/tauri";
import { Button } from "@/components/ui/button";

type SyncResults = PromiseSettledResult<SyncedSubscription>[];

// loadSubscriptions() returns a fresh object each call; stringify so
// useSyncExternalStore can bail out of re-render when the value is unchanged.
function getSnapshot() {
  return JSON.stringify(loadSubscriptions());
}

function getServerSnapshot() {
  return JSON.stringify({ subscriptions: [] });
}

// saveSubscription silently drops non-http(s) URLs, so this guards the toast
// that is the user's only feedback on invalid input.
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

function subscriptionSyncState(
  subscription: Subscription,
  isRefreshing: boolean
): { label: string; tone: "checking" | "current" | "stale" | "failed" } {
  if (isRefreshing) return { label: "Checking now", tone: "checking" };
  if (subscription.lastSyncErrorAt) return { label: "Needs retry", tone: "failed" };
  if (!subscription.lastFetchedAt) return { label: "Ready to check", tone: "stale" };
  return isSubscriptionStale(subscription)
    ? { label: "Refresh due", tone: "stale" }
    : { label: "Up to date", tone: "current" };
}

function SubscriptionRow({
  subscription,
  isRefreshing,
  isDisabled,
  onRefresh,
  onRemove,
}: {
  subscription: Subscription;
  isRefreshing: boolean;
  isDisabled: boolean;
  onRefresh: (subscription: Subscription) => void;
  onRemove: (subscription: Subscription) => void;
}) {
  const syncState = subscriptionSyncState(subscription, isRefreshing);

  return (
    <li className="subscription-item">
      <span className="subscription-item-body">
        <span className="subscription-item-title">{subscription.title}</span>
        <span className="subscription-item-details">
          <span className="subscription-item-url">{subscription.feedUrl}</span>
          <span className={`subscription-item-state is-${syncState.tone}`}>
            <span className="subscription-item-state-dot" aria-hidden />
            {syncState.label}
          </span>
        </span>
      </span>
      <span className="subscription-item-actions">
        {syncState.tone === "failed" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="subscription-item-retry"
            aria-label={`Retry ${subscription.title}`}
            disabled={isDisabled}
            onClick={() => onRefresh(subscription)}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="subscription-item-refresh"
            aria-label={`Refresh ${subscription.title}`}
            title="Refresh feed"
            disabled={isDisabled}
            onClick={() => onRefresh(subscription)}
          >
            {isRefreshing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-4 w-4" aria-hidden />
            )}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="subscription-item-remove"
          aria-label={`Remove ${subscription.title}`}
          title="Remove subscription"
          disabled={isDisabled}
          onClick={() => onRemove(subscription)}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </span>
    </li>
  );
}

function SubscriptionEmpty() {
  return (
    <div className="subscription-empty">
      <span className="subscription-empty-icon" aria-hidden>
        <Rss />
      </span>
      <div>
        <strong>Bring your reading sources together</strong>
        <p>Paste an RSS or Atom URL and new articles will arrive here automatically.</p>
      </div>
    </div>
  );
}

interface SubscriptionPanelProps {
  subscriptions: readonly Subscription[];
  url: string;
  isSyncing: boolean;
  isSyncingAll: boolean;
  refreshingFeedUrls: ReadonlySet<string>;
  syncStatus: string | null;
  onUrlChange: (value: string) => void;
  onAdd: () => void;
  onRefresh: (subscription: Subscription) => void;
  onRemove: (subscription: Subscription) => void;
  onSyncAll: () => void;
}

function SubscriptionPanel({
  subscriptions,
  url,
  isSyncing,
  isSyncingAll,
  refreshingFeedUrls,
  syncStatus,
  onUrlChange,
  onAdd,
  onRefresh,
  onRemove,
  onSyncAll,
}: SubscriptionPanelProps) {
  const trimmed = url.trim();
  const failedCount = subscriptions.filter((subscription) => subscription.lastSyncErrorAt).length;

  return (
    <section className="subscription-panel" aria-labelledby="subscription-manager-title">
      <div className="subscription-head-row">
        <div className="subscription-head">
          <h2 className="subscription-title" id="subscription-manager-title">
            Subscriptions
          </h2>
          <p className="subscription-sub">
            Add an RSS or Atom feed URL to follow it in your inbox.
          </p>
        </div>
        {subscriptions.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="subscription-sync-all"
            disabled={isSyncing}
            onClick={onSyncAll}
          >
            {isSyncingAll ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : (
              <RefreshCw aria-hidden />
            )}
            {isSyncingAll ? "Syncing feeds…" : "Sync feeds"}
          </Button>
        )}
      </div>
      {subscriptions.length > 0 && (
        <p className="subscription-sync-note" role="status">
          {syncStatus ?? "Inbox checks stale feeds when you open it."}
        </p>
      )}
      {failedCount > 0 ? (
        <p className="subscription-recovery-note" role="alert">
          <strong>
            {failedCount} feed{failedCount === 1 ? "" : "s"} needs attention.
          </strong>{" "}
          Your subscription and saved articles are safe. Check the URL or connection, then choose
          Retry beside that feed.
        </p>
      ) : null}

      <div className="subscription-form">
        <div className="connect-input-wrap subscription-input-wrap">
          <input
            className="connect-input"
            type="url"
            value={url}
            spellCheck={false}
            placeholder="https://example.com/feed.xml"
            aria-label="Feed URL"
            onChange={(event) => onUrlChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onAdd();
            }}
          />
        </div>
        <Button type="button" onClick={onAdd} disabled={trimmed === "" || isSyncing}>
          <Plus className="h-4 w-4" aria-hidden />
          Add
        </Button>
      </div>

      {subscriptions.length > 0 ? (
        <ul className="subscription-list">
          {subscriptions.map((subscription) => (
            <SubscriptionRow
              key={subscription.feedUrl}
              subscription={subscription}
              isRefreshing={refreshingFeedUrls.has(subscription.feedUrl)}
              isDisabled={isSyncing}
              onRefresh={onRefresh}
              onRemove={onRemove}
            />
          ))}
        </ul>
      ) : (
        <SubscriptionEmpty />
      )}
    </section>
  );
}

export default function SubscriptionManager() {
  const snapshot = useSyncExternalStore(subscribeSubscriptions, getSnapshot, getServerSnapshot);
  const subscriptions = (JSON.parse(snapshot) as SubscriptionsState).subscriptions;
  const [url, setUrl] = useState("");
  const [refreshingFeedUrls, setRefreshingFeedUrls] = useState<Set<string>>(new Set());
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
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

  useEffect(() => {
    const staleSubscriptions = loadSubscriptions().subscriptions.filter((subscription) =>
      isSubscriptionStale(subscription)
    );
    if (staleSubscriptions.length === 0) return;

    setSyncStatus(`Checking ${staleSubscriptions.length} saved feeds…`);
    void syncFeeds(staleSubscriptions, true)
      .then((results) => setSyncStatus(syncNotice(results)))
      .catch(() => setSyncStatus("Could not check saved feeds. Use Sync feeds to retry."));
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
    if (!existing) saveSubscription(subscription);
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

  function onRemove(subscription: Subscription) {
    if (isSyncing) return;
    deleteSubscription(subscription.feedUrl);
    toast.success("Removed subscription", { description: subscription.title });
  }

  return (
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
      onRemove={onRemove}
      onSyncAll={() => void onSyncAll()}
    />
  );
}
