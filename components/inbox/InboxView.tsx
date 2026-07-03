"use client";

import { ExternalLink, Newspaper } from "lucide-react";
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

const SAMPLE_INBOX_ITEMS: InboxItem[] = [
  {
    id: "sample-agent-run-completed",
    feedUrl: "https://example.com/feed.xml",
    sourceName: "Agent",
    title: "Agent run completed: Research Weekly Digest",
    url: "https://example.com/agent-run-completed",
    author: "Verto Agent",
    publishedAt: "2025-05-12T10:00:00.000Z",
    summary: "6 documents updated.",
    status: "unread",
    createdAt: "2025-05-12T10:00:00.000Z",
  },
  {
    id: "sample-john-mentioned",
    feedUrl: "https://example.com/feed.xml",
    sourceName: "Mentions",
    title: "John mentioned you in Key Features",
    url: "https://example.com/key-features",
    author: "John Carter",
    publishedAt: "2025-05-12T09:00:00.000Z",
    summary: "@Alex can you review this section?",
    status: "reading",
    createdAt: "2025-05-12T09:00:00.000Z",
  },
  {
    id: "sample-approval-request",
    feedUrl: "https://example.com/feed.xml",
    sourceName: "Approvals",
    title: "Approval requested: Update roadmap.md",
    url: "https://example.com/roadmap",
    author: "Agent",
    publishedAt: "2025-05-12T08:00:00.000Z",
    summary: "Agent wants to modify 2 files.",
    status: "unread",
    createdAt: "2025-05-12T08:00:00.000Z",
  },
  {
    id: "sample-sync-failed",
    feedUrl: "https://example.com/feed.xml",
    sourceName: "System",
    title: "Sync failed for OneDrive",
    url: "https://example.com/sync",
    author: "System",
    publishedAt: "2025-05-12T07:00:00.000Z",
    summary: "Click to retry connection.",
    status: "unread",
    createdAt: "2025-05-12T07:00:00.000Z",
  },
  {
    id: "sample-new-comment",
    feedUrl: "https://example.com/feed.xml",
    sourceName: "Comments",
    title: "New comment on Agent-native Workflows",
    url: "https://example.com/comment",
    author: "Olivia",
    publishedAt: "2025-05-11T12:00:00.000Z",
    summary: "Great write-up! One question on the evaluation part.",
    status: "read",
    createdAt: "2025-05-11T12:00:00.000Z",
  },
  {
    id: "sample-agent-failed",
    feedUrl: "https://example.com/feed.xml",
    sourceName: "Agent",
    title: "Agent run failed: Competitor Analysis",
    url: "https://example.com/agent-failed",
    author: "Verto Agent",
    publishedAt: "2025-05-11T10:00:00.000Z",
    summary: "Model timeout after 120s.",
    status: "unread",
    createdAt: "2025-05-11T10:00:00.000Z",
  },
  {
    id: "sample-weekly-summary",
    feedUrl: "https://example.com/feed.xml",
    sourceName: "Digest",
    title: "Weekly summary is ready",
    url: "https://example.com/weekly",
    author: "Verto",
    publishedAt: "2025-05-10T12:00:00.000Z",
    summary: "See what's new in your knowledge base.",
    status: "read",
    createdAt: "2025-05-10T12:00:00.000Z",
  },
  {
    id: "sample-new-document",
    feedUrl: "https://example.com/feed.xml",
    sourceName: "Library",
    title: "New document added: Design Principles",
    url: "https://example.com/design-principles",
    author: "Import",
    publishedAt: "2025-05-10T09:00:00.000Z",
    summary: "From Excalidraw import.",
    status: "read",
    createdAt: "2025-05-10T09:00:00.000Z",
  },
];

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
  const sampleMode = items.length === 0;
  const rows = sampleMode ? SAMPLE_INBOX_ITEMS : items;

  return (
    <div className={`inbox-page${sampleMode ? " inbox-page--triage" : ""}`}>
      <header className="inbox-head">
        <h1 className="inbox-title">{sampleMode ? "Inbox" : "Inbox"}</h1>
        <p className="inbox-subtitle">Articles collected from your subscriptions.</p>
      </header>

      {sampleMode && (
        <nav className="inbox-tabs" aria-label="Inbox filters">
          <button className="inbox-tab is-active" type="button">
            All <span>8</span>
          </button>
          <button className="inbox-tab" type="button">
            Mentions <span>3</span>
          </button>
          <button className="inbox-tab" type="button">
            Comments <span>2</span>
          </button>
          <button className="inbox-tab" type="button">
            Approvals <span>2</span>
          </button>
          <button className="inbox-tab" type="button">
            System <span>1</span>
          </button>
        </nav>
      )}

      <div className={sampleMode ? "inbox-workspace" : undefined}>
        <ul className="inbox-list">
          {rows.map((item) => (
            <InboxRow key={item.id} item={item} />
          ))}
        </ul>

        {sampleMode && (
          <aside className="inbox-triage-panel" aria-label="Triage preview">
            <h2>Triage</h2>
            <section>
              <h3>Approval request: roadmap.md</h3>
              <p>Agent wants to modify roadmap.md and principles-plan.md.</p>
            </section>
            <section>
              <h4>Files to be changed</h4>
              <ul>
                <li>roadmap.md</li>
                <li>principles-plan.md</li>
              </ul>
            </section>
            <section>
              <h4>Reason</h4>
              <p>Incorporate Q2 planning milestones based on decisions.</p>
            </section>
            <button type="button" className="inbox-review-btn">
              Review changes
            </button>
          </aside>
        )}
      </div>

      <SubscriptionManager />
    </div>
  );
}
