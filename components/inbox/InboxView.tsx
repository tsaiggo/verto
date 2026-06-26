"use client";

import { ExternalLink, Inbox } from "lucide-react";
import { useSyncExternalStore } from "react";
import { loadInbox, type InboxItem, type InboxState, type InboxStatus } from "@/lib/inbox";
import { formatDate } from "@/lib/format";
import SubscriptionManager from "@/components/inbox/SubscriptionManager";

function subscribeInbox(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot() {
  return JSON.stringify(loadInbox());
}

function getServerSnapshot() {
  return JSON.stringify({ items: [] });
}

const STATUS_LABELS: Record<InboxStatus, string> = {
  unread: "Unread",
  reading: "Reading",
  read: "Read",
  archived: "Archived",
};

function StatusBadge({ status }: { status: InboxStatus }) {
  return (
    <span className={`inbox-badge is-${status}`}>
      <span className="inbox-badge-dot" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

function InboxRow({ item }: { item: InboxItem }) {
  return (
    <li className="inbox-item">
      <div className="inbox-item-titlerow">
        <a className="inbox-item-title" href={item.url} target="_blank" rel="noopener noreferrer">
          {item.title}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
        <StatusBadge status={item.status} />
      </div>
      <div className="inbox-item-meta">
        {item.sourceName && <span>{item.sourceName}</span>}
        {item.author && <span>{item.author}</span>}
        {item.publishedAt && (
          <time className="inbox-item-time" dateTime={item.publishedAt}>
            {formatDate(item.publishedAt)}
          </time>
        )}
      </div>
      {item.summary && <p className="inbox-item-summary">{item.summary}</p>}
    </li>
  );
}

export default function InboxView() {
  const snapshot = useSyncExternalStore(subscribeInbox, getSnapshot, getServerSnapshot);
  const items = (JSON.parse(snapshot) as InboxState).items;

  return (
    <div className="inbox-page">
      <header className="inbox-head">
        <h1 className="inbox-title">Inbox</h1>
        <p className="inbox-subtitle">Articles collected from your subscriptions.</p>
      </header>

      {items.length > 0 ? (
        <ul className="inbox-list">
          {items.map((item) => (
            <InboxRow key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <div className="inbox-empty">
          <span className="inbox-empty-icon" aria-hidden>
            <Inbox className="h-6 w-6" />
          </span>
          <p>Your inbox is empty</p>
          <span>Subscribe to a feed below and new articles collect here automatically.</span>
        </div>
      )}

      <SubscriptionManager />
    </div>
  );
}
