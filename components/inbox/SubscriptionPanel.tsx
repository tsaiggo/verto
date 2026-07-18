"use client";

import { LoaderCircle, Plus, RefreshCw, Rss, Trash2 } from "lucide-react";
import { isSubscriptionStale, type Subscription } from "@/lib/subscriptions";
import { Button } from "@/components/ui/button";
import {
  ContentEmptyState,
  ContentRow,
  ContentSection,
  ContentStatus,
  ContentToolbar,
} from "@/components/ui/content-primitives";
import styles from "@/components/inbox/InboxView.module.css";

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
    <li>
      <ContentRow
        className={styles.subscriptionRow}
        leading={<Rss aria-hidden />}
        title={subscription.title}
        description={
          <span className={styles.subscriptionDetails}>
            <span>{subscription.feedUrl}</span>
            <span className={styles[`sync_${syncState.tone}`]}>{syncState.label}</span>
          </span>
        }
        actions={
          <span className={styles.subscriptionActions}>
            {syncState.tone === "failed" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={`Retry ${subscription.title}`}
                disabled={isDisabled}
                aria-busy={isRefreshing}
                onClick={() => onRefresh(subscription)}
              >
                <RefreshCw aria-hidden />
                Retry
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Refresh ${subscription.title}`}
                title="Refresh feed"
                disabled={isDisabled}
                aria-busy={isRefreshing}
                onClick={() => onRefresh(subscription)}
              >
                {isRefreshing ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : (
                  <RefreshCw aria-hidden />
                )}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={styles.removeSubscription}
              aria-label={`Remove ${subscription.title}`}
              title="Remove subscription and cached articles"
              disabled={isDisabled}
              onClick={() => onRemove(subscription)}
            >
              <Trash2 aria-hidden />
            </Button>
          </span>
        }
      />
    </li>
  );
}

export interface SubscriptionPanelProps {
  subscriptions: readonly Subscription[];
  url: string;
  isSyncing: boolean;
  isAdding: boolean;
  isSyncingAll: boolean;
  refreshingFeedUrls: ReadonlySet<string>;
  syncStatus: string | null;
  onUrlChange: (value: string) => void;
  onAdd: () => void;
  onRefresh: (subscription: Subscription) => void;
  onRemove: (subscription: Subscription) => void;
  onSyncAll: () => void;
}

export default function SubscriptionPanel({
  subscriptions,
  url,
  isSyncing,
  isAdding,
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
  const isBusy = isSyncing || isAdding;

  return (
    <ContentSection
      className={styles.subscriptionSection}
      title="Subscriptions"
      description="Follow an RSS or Atom feed in your inbox."
      actions={
        subscriptions.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy}
            aria-busy={isSyncingAll}
            onClick={onSyncAll}
          >
            {isSyncingAll ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : (
              <RefreshCw aria-hidden />
            )}
            {isSyncingAll ? "Syncing feeds…" : "Sync feeds"}
          </Button>
        ) : undefined
      }
    >
      {isSyncing ? (
        <ContentStatus
          status="loading"
          title={syncStatus ?? "Checking feeds"}
          description="New articles are saved to Inbox as each feed completes."
          className={styles.subscriptionStatus}
        />
      ) : failedCount > 0 ? (
        <ContentStatus
          status="error"
          title={`${failedCount} feed${failedCount === 1 ? "" : "s"} needs attention`}
          description="Your subscription and saved articles are safe. Check the URL or connection, then retry that feed."
          className={`${styles.subscriptionStatus} subscription-recovery-note`}
        />
      ) : syncStatus ? (
        <ContentStatus title={syncStatus} className={styles.subscriptionStatus} />
      ) : subscriptions.length > 0 ? (
        <p className={styles.subscriptionNote}>Inbox checks stale feeds when you open it.</p>
      ) : null}

      <div className={styles.subscriptionFormGroup}>
        <label htmlFor="inbox-feed-url">Feed URL</label>
        <ContentToolbar className={styles.subscriptionForm}>
          <input
            id="inbox-feed-url"
            className={styles.subscriptionInput}
            type="url"
            value={url}
            spellCheck={false}
            placeholder="https://example.com/feed.xml"
            disabled={isAdding}
            onChange={(event) => onUrlChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && trimmed !== "" && !isBusy) onAdd();
            }}
          />
          <Button
            type="button"
            onClick={onAdd}
            disabled={trimmed === "" || isBusy}
            aria-busy={isAdding}
          >
            {isAdding ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : (
              <Plus aria-hidden />
            )}
            {isAdding ? "Adding…" : "Add"}
          </Button>
        </ContentToolbar>
      </div>

      {subscriptions.length > 0 ? (
        <ul className={styles.subscriptionList}>
          {subscriptions.map((subscription) => (
            <SubscriptionRow
              key={subscription.feedUrl}
              subscription={subscription}
              isRefreshing={refreshingFeedUrls.has(subscription.feedUrl)}
              isDisabled={isBusy}
              onRefresh={onRefresh}
              onRemove={onRemove}
            />
          ))}
        </ul>
      ) : (
        <ContentEmptyState
          compact
          className={styles.subscriptionEmpty}
          icon={<Rss aria-hidden />}
          title="Bring your reading sources together"
          description="Paste an RSS or Atom URL and new articles will arrive here automatically."
        />
      )}
    </ContentSection>
  );
}
