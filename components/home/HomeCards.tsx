"use client";

import Link from "next/link";
import { ArrowRight, FileText, FolderClosed, MessageSquareText, Rss } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import type { LibraryGroup, RecentDoc } from "@/components/home/home-data";
import { getInboxAttentionCount, loadInbox, subscribeInbox, type InboxItem } from "@/lib/inbox";
import { loadSubscriptions, subscribeSubscriptions } from "@/lib/subscriptions";

export function RecentEditsCard({ docs }: { docs: RecentDoc[] }) {
  return (
    <section className="home-recent-card" aria-labelledby="home-recent-heading">
      <header className="home-section-head">
        <h2 id="home-recent-heading">Recently Updated</h2>
      </header>
      <ul className="home-list">
        {docs.slice(0, 3).map((doc) => (
          <li key={`${doc.href}-${doc.title}`}>
            <Link href={doc.href} className="home-list-row">
              <FileText className="home-list-icon" aria-hidden />
              <span className="home-list-body">
                <strong className="home-list-title">{doc.title}</strong>
                <span className="home-list-meta">{doc.section}</span>
              </span>
              {doc.iso ? (
                <time className="home-list-date" dateTime={doc.iso}>
                  {doc.relative}
                </time>
              ) : (
                <span className="home-list-date">Date unavailable</span>
              )}
            </Link>
          </li>
        ))}
        {docs.length === 0 ? (
          <li className="home-list-empty">No documents available yet.</li>
        ) : null}
      </ul>
      {docs.length > 3 ? (
        <Link href="/library" className="home-section-link home-more">
          View all documents
          <ArrowRight aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}

export function AgentAskCard({ documentCount }: { documentCount: number }) {
  return (
    <Link href="/agent" className="home-agent-entry">
      <MessageSquareText aria-hidden />
      <span>
        <strong>Ask your library</strong>
        <small>
          {documentCount} readable {documentCount === 1 ? "document" : "documents"}
        </small>
      </span>
      <ArrowRight aria-hidden />
    </Link>
  );
}

interface InboxTriageSnapshot {
  items: InboxItem[];
  subscriptionCount: number;
}
export interface InboxTriageSummary {
  kind: "setup" | "caught-up" | "attention";
  unread: number;
  reading: number;
  subscriptionCount: number;
  actionHref: "/inbox" | "/inbox#subscriptions";
  actionLabel: "Add your first feed" | "Review inbox";
}
function subscribeInboxTriage(callback: () => void) {
  const unsubscribeInbox = subscribeInbox(callback);
  const unsubscribeSubscriptions = subscribeSubscriptions(callback);
  return () => {
    unsubscribeInbox();
    unsubscribeSubscriptions();
  };
}
function getInboxTriageSnapshot() {
  return JSON.stringify({
    items: loadInbox().items,
    subscriptionCount: loadSubscriptions().subscriptions.length,
  });
}
function getServerInboxTriageSnapshot() {
  return JSON.stringify({ items: [], subscriptionCount: 0 });
}
function parseInboxTriageSnapshot(snapshot: string): InboxTriageSnapshot {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (parsed && typeof parsed === "object" && "items" in parsed && Array.isArray(parsed.items)) {
      return {
        items: parsed.items as InboxItem[],
        subscriptionCount:
          "subscriptionCount" in parsed &&
          typeof parsed.subscriptionCount === "number" &&
          Number.isFinite(parsed.subscriptionCount)
            ? Math.max(0, parsed.subscriptionCount)
            : 0,
      };
    }
  } catch {
    /* Browser storage is optional. */
  }
  return { items: [], subscriptionCount: 0 };
}
export function deriveInboxTriageSummary(
  items: readonly InboxItem[],
  subscriptionCount: number
): InboxTriageSummary {
  const unread = items.filter((item) => item.status === "unread").length;
  const reading = items.filter((item) => item.status === "reading").length;
  const attention = getInboxAttentionCount(items);
  const normalizedSubscriptionCount = Math.max(0, subscriptionCount);
  if (attention > 0)
    return {
      kind: "attention",
      unread,
      reading,
      subscriptionCount: normalizedSubscriptionCount,
      actionHref: "/inbox",
      actionLabel: "Review inbox",
    };
  if (normalizedSubscriptionCount > 0)
    return {
      kind: "caught-up",
      unread,
      reading,
      subscriptionCount: normalizedSubscriptionCount,
      actionHref: "/inbox",
      actionLabel: "Review inbox",
    };
  return {
    kind: "setup",
    unread,
    reading,
    subscriptionCount: 0,
    actionHref: "/inbox#subscriptions",
    actionLabel: "Add your first feed",
  };
}
export function InboxTriageCard() {
  const snapshot = useSyncExternalStore(
    subscribeInboxTriage,
    getInboxTriageSnapshot,
    getServerInboxTriageSnapshot
  );
  const triage = useMemo(() => parseInboxTriageSnapshot(snapshot), [snapshot]);
  const summary = useMemo(
    () => deriveInboxTriageSummary(triage.items, triage.subscriptionCount),
    [triage]
  );
  const copy =
    summary.kind === "attention"
      ? `${summary.unread} unread ${summary.unread === 1 ? "article" : "articles"}${summary.reading ? ` · ${summary.reading} in progress` : ""}`
      : summary.kind === "caught-up"
        ? `No unread articles across ${summary.subscriptionCount} ${summary.subscriptionCount === 1 ? "feed" : "feeds"}.`
        : "Follow an RSS or Atom feed to collect new articles.";

  return (
    <section className="home-inbox-card" aria-labelledby="home-inbox-heading">
      <span className="home-inbox-icon" aria-hidden>
        <Rss />
      </span>
      <div className="home-inbox-copy">
        <h2 id="home-inbox-heading">Inbox</h2>
        <p>{copy}</p>
      </div>
      <Link href={summary.actionHref} className="home-section-link home-inbox-action">
        {summary.actionLabel}
        <ArrowRight aria-hidden />
      </Link>
    </section>
  );
}

export function RecentCollectionsRow({ groups }: { groups: LibraryGroup[] }) {
  return (
    <section className="home-library-sections" aria-labelledby="home-sections-heading">
      <header className="home-section-head">
        <h2 id="home-sections-heading">Library Sections</h2>
        <Link href="/library" className="home-section-link">
          Open library
          <ArrowRight aria-hidden />
        </Link>
      </header>
      {groups.length > 0 ? (
        <ul className="home-section-list">
          {groups.slice(0, 4).map((group) => (
            <li key={`${group.href}-${group.title}`}>
              <Link href={group.href} className="home-section-row">
                <FolderClosed aria-hidden />
                <strong>{group.title}</strong>
                <span>
                  {group.total} {group.total === 1 ? "document" : "documents"}
                </span>
                <ArrowRight aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="home-muted">
          Your source folders will appear here when they contain readable documents.
        </p>
      )}
    </section>
  );
}
