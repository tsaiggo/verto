"use client";

import { ExternalLink, Inbox, Newspaper } from "lucide-react";
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
  return <span className={`inbox-badge is-${status}`}>{STATUS_LABELS[status]}</span>;
}

function InboxRow({ item }: { item: InboxItem }) {
  return (
    <li className="inbox-item">
      <a className="inbox-card" href={item.url} target="_blank" rel="noopener noreferrer">
        <span className="inbox-card-icon" aria-hidden>
          <Newspaper />
        </span>
        <span className="inbox-card-body">
          <span className="inbox-card-titlerow">
            <span className="inbox-card-title">
              <span className="inbox-card-title-text">{item.title}</span>
              <ExternalLink className="inbox-card-extlink" aria-hidden />
            </span>
            <StatusBadge status={item.status} />
          </span>
          <span className="inbox-card-meta">
            {item.sourceName && <span>{item.sourceName}</span>}
            {item.author && <span>{item.author}</span>}
            {item.publishedAt && (
              <time className="inbox-card-time" dateTime={item.publishedAt}>
                {formatDate(item.publishedAt)}
              </time>
            )}
          </span>
          {item.summary && <span className="inbox-card-summary">{item.summary}</span>}
        </span>
      </a>
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
