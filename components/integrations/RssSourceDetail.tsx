"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
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
    .map((sub) => sub.lastFetchedAt)
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
      <div>
        <div className={styles.rssMeta}>
          <span className={styles.rssMetaItem}>
            <strong>Feeds</strong>
            {subscriptions.length.toLocaleString()}
          </span>
          <span className={styles.rssMetaItem}>
            <strong>Destination</strong>
            Inbox
          </span>
          <span className={styles.rssMetaItem}>
            <strong>Last sync</strong>
            {lastSync === "-" ? "Not synced" : lastSync}
          </span>
        </div>

        {failedCount > 0 ? (
          <p className={styles.rssRecovery} role="alert">
            <strong>
              {failedCount} feed{failedCount === 1 ? "" : "s"} needs attention.
            </strong>{" "}
            It remains subscribed; retry it from Inbox after checking the URL or connection.
          </p>
        ) : null}

        <div className={styles.rssActions}>
          <Link href="/inbox" className="v-btn v-btn--sm">
            Manage in Inbox
          </Link>
        </div>
      </div>

      {subscriptions.length > 0 ? (
        <div className={styles.rssList}>
          <strong>Subscriptions</strong>
          <ul>
            {subscriptions.slice(0, 5).map((subscription) => (
              <li key={subscription.feedUrl}>
                <span>{subscription.title}</span>
                <small>{subscription.feedUrl}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.rssEmpty}>No RSS feeds yet. Add a feed URL from Inbox.</p>
      )}
    </div>
  );
}
