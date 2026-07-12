"use client";

import { LoaderCircle, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { saveInboxItem, loadInbox } from "@/lib/inbox";
import { refreshSubscription } from "@/lib/feeds/refresh";
import {
  deleteSubscription,
  loadSubscriptions,
  saveSubscription,
  type Subscription,
  type SubscriptionsState,
} from "@/lib/subscriptions";
import { tauriFetch } from "@/lib/tauri";
import { Button } from "@/components/ui/button";

function subscribeSubscriptions(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

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

function pluralizedArticles(count: number): string {
  return `${count} new ${count === 1 ? "article" : "articles"} added to Inbox`;
}

async function syncSubscription(subscription: Subscription) {
  const existingIds = new Set(loadInbox().items.map((item) => item.id));
  const fetchImpl = await tauriFetch();
  const result = await refreshSubscription(subscription, fetchImpl);

  saveSubscription(result.subscription);
  result.items.forEach(saveInboxItem);

  return {
    subscription: result.subscription,
    addedCount: result.items.filter((item) => !existingIds.has(item.id)).length,
  };
}

function SubscriptionRow({
  subscription,
  isRefreshing,
  onRefresh,
  onRemove,
}: {
  subscription: Subscription;
  isRefreshing: boolean;
  onRefresh: (subscription: Subscription) => void;
  onRemove: (subscription: Subscription) => void;
}) {
  return (
    <li className="subscription-item">
      <span className="subscription-item-body">
        <span className="subscription-item-title">{subscription.title}</span>
        <span className="subscription-item-url">{subscription.feedUrl}</span>
      </span>
      <span className="subscription-item-actions">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="subscription-item-refresh"
          aria-label={`Refresh ${subscription.title}`}
          title="Refresh feed"
          disabled={isRefreshing}
          onClick={() => onRefresh(subscription)}
        >
          {isRefreshing ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="subscription-item-remove"
          aria-label={`Remove ${subscription.title}`}
          title="Remove subscription"
          disabled={isRefreshing}
          onClick={() => onRemove(subscription)}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </span>
    </li>
  );
}

export default function SubscriptionManager() {
  const snapshot = useSyncExternalStore(subscribeSubscriptions, getSnapshot, getServerSnapshot);
  const subscriptions = (JSON.parse(snapshot) as SubscriptionsState).subscriptions;

  const [url, setUrl] = useState("");
  const [refreshingFeedUrl, setRefreshingFeedUrl] = useState<string | null>(null);
  const trimmed = url.trim();

  async function onAdd() {
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
    setRefreshingFeedUrl(value);

    try {
      const result = await syncSubscription(subscription);
      toast.success(
        existing
          ? `Synced ${result.subscription.title}`
          : `Subscribed to ${result.subscription.title}`,
        {
          description:
            result.addedCount > 0
              ? pluralizedArticles(result.addedCount)
              : "No new articles were found.",
        }
      );
    } catch {
      toast.error(
        existing
          ? `Couldn't refresh ${subscription.title}`
          : "Subscription saved, but couldn't fetch it",
        {
          description: "Check the feed URL, then use Refresh to try again.",
        }
      );
    } finally {
      setRefreshingFeedUrl(null);
    }
  }

  async function onRefresh(subscription: Subscription) {
    setRefreshingFeedUrl(subscription.feedUrl);
    try {
      const result = await syncSubscription(subscription);
      toast.success(`Synced ${result.subscription.title}`, {
        description:
          result.addedCount > 0
            ? pluralizedArticles(result.addedCount)
            : "No new articles were found.",
      });
    } catch {
      toast.error(`Couldn't refresh ${subscription.title}`, {
        description: "Check the feed URL, then try again.",
      });
    } finally {
      setRefreshingFeedUrl(null);
    }
  }

  function onRemove(sub: Subscription) {
    deleteSubscription(sub.feedUrl);
    toast.success("Removed subscription", { description: sub.title });
  }

  return (
    <section className="subscription-panel" aria-labelledby="subscription-manager-title">
      <div className="subscription-head">
        <h2 className="subscription-title" id="subscription-manager-title">
          Subscriptions
        </h2>
        <p className="subscription-sub">Add an RSS or Atom feed URL to follow it in your inbox.</p>
      </div>

      <div className="subscription-form">
        <div className="connect-input-wrap subscription-input-wrap">
          <input
            className="connect-input"
            type="url"
            value={url}
            spellCheck={false}
            placeholder="https://example.com/feed.xml"
            aria-label="Feed URL"
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onAdd();
            }}
          />
        </div>
        <Button
          type="button"
          onClick={onAdd}
          disabled={trimmed === "" || refreshingFeedUrl !== null}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {refreshingFeedUrl === trimmed ? "Adding…" : "Add"}
        </Button>
      </div>

      {subscriptions.length > 0 ? (
        <ul className="subscription-list">
          {subscriptions.map((subscription) => (
            <SubscriptionRow
              key={subscription.feedUrl}
              subscription={subscription}
              isRefreshing={refreshingFeedUrl === subscription.feedUrl}
              onRefresh={onRefresh}
              onRemove={onRemove}
            />
          ))}
        </ul>
      ) : (
        <p className="subscription-empty">No subscriptions yet. Add a feed URL to start.</p>
      )}
    </section>
  );
}
