"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  deleteSubscription,
  loadSubscriptions,
  saveSubscription,
  type Subscription,
  type SubscriptionsState,
} from "@/lib/subscriptions";
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

export default function SubscriptionManager() {
  const snapshot = useSyncExternalStore(subscribeSubscriptions, getSnapshot, getServerSnapshot);
  const subscriptions = (JSON.parse(snapshot) as SubscriptionsState).subscriptions;

  const [url, setUrl] = useState("");
  const trimmed = url.trim();

  function onAdd() {
    const value = url.trim();
    if (!isValidFeedUrl(value)) {
      toast.error("Enter a valid http(s) feed URL");
      return;
    }
    // Provisional title — a later refresh PR overwrites it with the real feed.title.
    const title = new URL(value).hostname;
    saveSubscription({ feedUrl: value, title, createdAt: new Date().toISOString() });
    toast.success(`Subscribed to ${title}`);
    setUrl("");
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
        <Button type="button" onClick={onAdd} disabled={trimmed === ""}>
          <Plus className="h-4 w-4" aria-hidden />
          Add
        </Button>
      </div>

      {subscriptions.length > 0 ? (
        <ul className="subscription-list">
          {subscriptions.map((sub) => (
            <li className="subscription-item" key={sub.feedUrl}>
              <span className="subscription-item-body">
                <span className="subscription-item-title">{sub.title}</span>
                <span className="subscription-item-url">{sub.feedUrl}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="subscription-item-remove"
                aria-label={`Remove ${sub.title}`}
                onClick={() => onRemove(sub)}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="subscription-empty">No subscriptions yet. Add a feed URL to start.</p>
      )}
    </section>
  );
}
