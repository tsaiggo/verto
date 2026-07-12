"use client";

import {
  Archive,
  BookOpen,
  CheckCheck,
  ExternalLink,
  Mail,
  Newspaper,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import {
  deleteInboxItem,
  loadInbox,
  setInboxStatus,
  subscribeInbox,
  type InboxItem,
  type InboxState,
  type InboxStatus,
} from "@/lib/inbox";
import { formatDate } from "@/lib/format";
import InboxArticlePreview from "@/components/inbox/InboxArticlePreview";
import SubscriptionManager from "@/components/inbox/SubscriptionManager";

function getSnapshot(): string {
  return JSON.stringify(loadInbox());
}

function getServerSnapshot(): string {
  return JSON.stringify({ items: [] });
}

// ---- Tab filtering ----

type TabFilter = "all" | "unread" | "read" | "archived";

const TABS: ReadonlyArray<{ id: TabFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "read", label: "Read" },
  { id: "archived", label: "Archived" },
];

function matchesTab(item: InboxItem, tab: TabFilter): boolean {
  switch (tab) {
    case "all":
      return item.status !== "archived";
    case "unread":
      return item.status === "unread" || item.status === "reading";
    case "read":
      return item.status === "read";
    case "archived":
      return item.status === "archived";
  }
}

// ---- Status badge ----

const STATUS_LABELS: Record<InboxStatus, string> = {
  unread: "Unread",
  reading: "Reading",
  read: "Read",
  archived: "Archived",
};

function StatusBadge({ status }: { status: InboxStatus }) {
  return <span className={`inbox-badge is-${status}`}>{STATUS_LABELS[status]}</span>;
}

// ---- Item action buttons ----

function InboxItemActions({ item }: { item: InboxItem }) {
  const { id, status } = item;
  switch (status) {
    case "unread":
    case "reading":
      return (
        <div className="inbox-item-actions">
          <a
            className="inbox-action-btn"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open original article: ${item.title}`}
            title="Open original article"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
          <button
            type="button"
            className="inbox-action-btn"
            aria-label="Mark as read"
            title="Mark as read"
            onClick={() => setInboxStatus(id, "read")}
          >
            <CheckCheck className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className="inbox-action-btn"
            aria-label="Archive"
            title="Archive"
            onClick={() => setInboxStatus(id, "archived")}
          >
            <Archive className="h-4 w-4" aria-hidden />
          </button>
        </div>
      );
    case "read":
      return (
        <div className="inbox-item-actions">
          <a
            className="inbox-action-btn"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open original article: ${item.title}`}
            title="Open original article"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
          <button
            type="button"
            className="inbox-action-btn"
            aria-label="Mark as unread"
            title="Mark as unread"
            onClick={() => setInboxStatus(id, "unread")}
          >
            <Mail className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className="inbox-action-btn"
            aria-label="Archive"
            title="Archive"
            onClick={() => setInboxStatus(id, "archived")}
          >
            <Archive className="h-4 w-4" aria-hidden />
          </button>
        </div>
      );
    case "archived":
      return (
        <div className="inbox-item-actions">
          <a
            className="inbox-action-btn"
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open original article: ${item.title}`}
            title="Open original article"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
          <button
            type="button"
            className="inbox-action-btn"
            aria-label="Restore to inbox"
            title="Restore to inbox"
            onClick={() => setInboxStatus(id, "unread")}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className="inbox-action-btn inbox-action-btn--destructive"
            aria-label={`Delete ${item.title} from inbox`}
            title="Delete from inbox"
            onClick={() => deleteInboxItem(id)}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      );
  }
}

// ---- Inbox row ----

function InboxRow({ item, onPreview }: { item: InboxItem; onPreview: (item: InboxItem) => void }) {
  return (
    <li className="inbox-item">
      <button
        type="button"
        className="inbox-card"
        aria-label={`Preview ${item.title}`}
        onClick={() => onPreview(item)}
      >
        <span className="inbox-card-icon" aria-hidden>
          <BookOpen />
        </span>
        <span className="inbox-card-body">
          <span className="inbox-card-titlerow">
            <span className="inbox-card-title">
              <span className="inbox-card-title-text">{item.title}</span>
              <BookOpen className="inbox-card-extlink" aria-hidden />
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
      </button>
      <InboxItemActions item={item} />
    </li>
  );
}

// ---- Empty state ----

function InboxEmpty({ tab }: { tab: TabFilter }) {
  const message = tab === "all" ? "Your inbox is empty." : `No ${tab} items.`;
  const hint =
    tab === "all"
      ? "Add a subscription below to start receiving articles."
      : "Items will appear here once their status matches.";
  return (
    <div className="inbox-empty" role="status">
      <div className="inbox-empty-icon" aria-hidden>
        <Newspaper className="h-5 w-5" />
      </div>
      <p>{message}</p>
      <span>{hint}</span>
    </div>
  );
}

// ---- Main view ----

export default function InboxView() {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [previewedItemId, setPreviewedItemId] = useState<string | null>(null);
  const snapshot = useSyncExternalStore(subscribeInbox, getSnapshot, getServerSnapshot);
  const { items } = JSON.parse(snapshot) as InboxState;

  const filtered = items.filter((item) => matchesTab(item, activeTab));
  const previewedItem = items.find((item) => item.id === previewedItemId) ?? null;

  function previewItem(item: InboxItem) {
    if (item.status === "unread") setInboxStatus(item.id, "reading");
    setPreviewedItemId(item.id);
  }

  return (
    <div className="inbox-page">
      <header className="inbox-head">
        <h1 className="inbox-title">Inbox</h1>
        <p className="inbox-subtitle">Articles collected from your subscriptions.</p>
      </header>

      <nav className="inbox-tabs" aria-label="Inbox filters">
        {TABS.map(({ id, label }) => {
          const count = items.filter((item) => matchesTab(item, id)).length;
          return (
            <button
              key={id}
              type="button"
              className={`inbox-tab${activeTab === id ? " is-active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              {label}
              {count > 0 && <span>{count}</span>}
            </button>
          );
        })}
      </nav>

      {filtered.length > 0 ? (
        <ul className="inbox-list">
          {filtered.map((item) => (
            <InboxRow key={item.id} item={item} onPreview={previewItem} />
          ))}
        </ul>
      ) : (
        <InboxEmpty tab={activeTab} />
      )}

      <SubscriptionManager />
      <InboxArticlePreview
        item={previewedItem}
        open={previewedItem !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewedItemId(null);
        }}
      />
    </div>
  );
}
