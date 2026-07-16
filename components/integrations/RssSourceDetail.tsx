"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentEmptyState, ContentStatus } from "@/components/ui/content-primitives";
import { loadSubscriptions, type Subscription, type SubscriptionsState } from "@/lib/subscriptions";
import styles from "./Sources.module.css";

function subscribeSubscriptions(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSubscriptionsSnapshot(): string {
  return JSON.stringify(loadSubscriptions());
}

function getServerSubscriptionsSnapshot(): string {
  const empty: SubscriptionsState = { subscriptions: [] };
  return JSON.stringify(empty);
}

export function useSubscriptions(): Subscription[] {
  const snapshot = useSyncExternalStore(
    subscribeSubscriptions,
    getSubscriptionsSnapshot,
    getServerSubscriptionsSnapshot
  );
  return useMemo(() => (JSON.parse(snapshot) as SubscriptionsState).subscriptions, [snapshot]);
}

function latestSubscriptionTimestamp(subscriptions: readonly Subscription[]): string | null {
  const timestamps = subscriptions
    .map((subscription) => subscription.lastFetchedAt)
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps)).toISOString();
}

export function formatRssSync(subscriptions: readonly Subscription[]): string {
  if (subscriptions.length === 0) return "-";
  const latest = latestSubscriptionTimestamp(subscriptions);
  if (!latest) return "-";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(latest)
  );
}

export default function RssSourceDetail({
  subscriptions,
  lastSync,
}: {
  subscriptions: readonly Subscription[];
  lastSync: string;
}) {
  const failedCount = subscriptions.filter((subscription) => subscription.lastSyncErrorAt).length;

  return (
    <div className={styles.rssDetail}>
      <dl className={styles.metrics}>
        <div>
          <dt>Feeds</dt>
          <dd>{subscriptions.length.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Destination</dt>
          <dd>Inbox</dd>
        </div>
        <div>
          <dt>Last sync</dt>
          <dd>{lastSync === "-" ? "Not synced" : lastSync}</dd>
        </div>
      </dl>

      {subscriptions.length > 0 ? (
        <div className={styles.subscriptionList}>
          <strong>Subscriptions</strong>
          <ul>
            {subscriptions.slice(0, 5).map((subscription) => (
              <li key={subscription.feedUrl}>
                <span>{subscription.title}</span>
                <small title={subscription.feedUrl}>{subscription.feedUrl}</small>
              </li>
            ))}
          </ul>
          {subscriptions.length > 5 ? (
            <p>Showing 5 of {subscriptions.length.toLocaleString()} feeds.</p>
          ) : null}
        </div>
      ) : (
        <ContentEmptyState
          compact
          className={styles.rssEmpty}
          icon={<Rss aria-hidden />}
          title="No RSS feeds yet"
          description="Add an RSS or Atom URL from Inbox to start receiving items."
          action={
            <Button asChild size="sm">
              <Link href="/inbox">Add a feed</Link>
            </Button>
          }
        />
      )}

      {failedCount > 0 ? (
        <div className={styles.statusBlock}>
          <ContentStatus
            status="error"
            title={`${failedCount} feed${failedCount === 1 ? "" : "s"} needs attention`}
            description="The subscription is still saved. Check its URL or connection, then retry from Inbox."
          />
        </div>
      ) : null}

      {subscriptions.length > 0 ? (
        <div className={styles.primaryActions}>
          <Button asChild variant="outline" size="sm">
            <Link href="/inbox">Manage in Inbox</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
