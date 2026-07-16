"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  FileText,
  FolderClosed,
  Inbox as InboxIcon,
  NotebookPen,
  PencilLine,
  Plus,
  Quote,
  Rss,
  Waypoints,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import type { LibraryGroup, RecentDoc } from "@/components/home/home-data";
import { getInboxAttentionCount, loadInbox, subscribeInbox, type InboxItem } from "@/lib/inbox";
import { loadSubscriptions, subscribeSubscriptions } from "@/lib/subscriptions";

/* ---- Recent Edits ------------------------------------------------------- */

export function RecentEditsCard({ docs }: { docs: RecentDoc[] }) {
  const more = Math.max(0, docs.length - 3);
  return (
    <section className="v-card home-card">
      <div className="v-cardhead">
        <span className="v-cardhead-title">
          <PencilLine aria-hidden />
          Recently Updated
        </span>
      </div>
      <div className="v-card-divider" />
      <ul className="home-list">
        {docs.slice(0, 3).map((doc) => (
          <li key={`${doc.href}-${doc.title}`}>
            <Link href={doc.href} className="home-list-row">
              <FileText className="home-list-icon" aria-hidden />
              <span className="home-list-body">
                <span className="home-list-title">{doc.title}</span>
                <span className="home-list-meta">
                  {doc.relative.startsWith("Edited")
                    ? doc.relative
                    : `Edited ${doc.relative || "recently"}`}
                </span>
              </span>
            </Link>
          </li>
        ))}
        {docs.length === 0 && <li className="home-list-empty">No documents available yet.</li>}
      </ul>
      {more > 0 && (
        <Link href="/library" className="home-more">
          View {more} more
        </Link>
      )}
    </section>
  );
}

/* ---- Agent Highlights --------------------------------------------------- */

export function AgentHighlightsCard() {
  return (
    <section className="v-card home-card">
      <div className="v-cardhead">
        <span className="v-cardhead-title">
          <Waypoints aria-hidden />
          Document intelligence
        </span>
      </div>
      <div className="v-card-divider" />
      <div className="home-card-body">
        <p className="home-muted">
          When a document is open, ask from its full text and save approved notes or summaries back
          to your library.
        </p>
        <div className="home-agent-capabilities" aria-label="Reading companion capabilities">
          <span>
            <FileText aria-hidden /> Page context
          </span>
          <span>
            <Quote aria-hidden /> Highlight notes
          </span>
          <span>
            <NotebookPen aria-hidden /> Saved summaries
          </span>
        </div>
      </div>
      <div className="v-card-divider" />
      <div className="home-card-foot">
        <Link href="/agent" className="v-cardhead-link">
          Open agent
        </Link>
      </div>
    </section>
  );
}

/* ---- Inbox / Triage ----------------------------------------------------- */

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
    // Fall through to the empty snapshot when browser storage is unavailable
    // or contains stale, malformed data.
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

  if (attention > 0) {
    return {
      kind: "attention",
      unread,
      reading,
      subscriptionCount: normalizedSubscriptionCount,
      actionHref: "/inbox",
      actionLabel: "Review inbox",
    };
  }

  if (normalizedSubscriptionCount > 0) {
    return {
      kind: "caught-up",
      unread,
      reading,
      subscriptionCount: normalizedSubscriptionCount,
      actionHref: "/inbox",
      actionLabel: "Review inbox",
    };
  }

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

  const feedLabel =
    summary.subscriptionCount === 1
      ? "1 feed connected"
      : summary.subscriptionCount > 1
        ? `${summary.subscriptionCount} feeds connected`
        : summary.kind === "attention"
          ? "Inbox needs attention"
          : "No feeds yet";

  return (
    <section className="v-card home-card">
      <div className="v-cardhead">
        <span className="v-cardhead-title">
          <InboxIcon aria-hidden />
          Inbox
        </span>
      </div>
      <div className="v-card-divider" />
      {summary.kind === "attention" ? (
        <ul className="home-triage">
          {summary.unread > 0 && (
            <li className="home-triage-row">
              <Bookmark className="home-triage-icon" aria-hidden />
              <span className="home-triage-title">
                {summary.unread} unread {summary.unread === 1 ? "article" : "articles"}
              </span>
            </li>
          )}
          {summary.reading > 0 && (
            <li className="home-triage-row">
              <BookOpen className="home-triage-icon" aria-hidden />
              <span className="home-triage-title">
                {summary.reading} article{summary.reading === 1 ? "" : "s"} in progress
              </span>
            </li>
          )}
        </ul>
      ) : summary.kind === "caught-up" ? (
        <div className="home-inbox-state" role="status">
          <span className="home-inbox-state-icon is-ready" aria-hidden>
            <Rss />
          </span>
          <div className="home-inbox-state-copy">
            <p className="home-inbox-state-title">
              {summary.subscriptionCount} active{" "}
              {summary.subscriptionCount === 1 ? "feed" : "feeds"}
            </p>
            <p className="home-muted">
              All caught up. New articles will appear here automatically.
            </p>
          </div>
        </div>
      ) : (
        <div className="home-inbox-state">
          <span className="home-inbox-state-icon" aria-hidden>
            <Rss />
          </span>
          <div className="home-inbox-state-copy">
            <p className="home-inbox-state-title">Start your reading inbox</p>
            <p className="home-muted">
              Follow an RSS or Atom feed and new articles will arrive here.
            </p>
          </div>
        </div>
      )}
      <div className="v-card-divider" />
      <div className="home-card-foot">
        <span className="home-inbox-status">{feedLabel}</span>
        <Link href={summary.actionHref} className="v-btn v-btn--sm home-inbox-action">
          {summary.actionLabel}
          <ArrowRight aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/* ---- Recent Collections ------------------------------------------------- */

const COLLECTION_ICONS: LucideIcon[] = [BookOpen, PencilLine, FileText, FolderClosed, Bookmark];

export function RecentCollectionsRow({ groups }: { groups: LibraryGroup[] }) {
  const items = groups.slice(0, 4);
  return (
    <section className="v-card home-collections">
      <div className="v-cardhead home-collections-head">
        <span className="v-cardhead-title">
          <FolderClosed aria-hidden />
          Library Sections
        </span>
        <Link href="/collections" className="v-btn v-btn--sm home-collections-new">
          <Plus aria-hidden /> Collections
        </Link>
      </div>
      <div className="v-card-divider" />
      {items.length > 0 ? (
        <div className="home-collections-grid">
          {items.map((group, i) => {
            const Icon = COLLECTION_ICONS[i % COLLECTION_ICONS.length];
            return (
              <Link
                key={`${group.href}-${group.title}`}
                href={group.href}
                className="v-card home-collection"
              >
                <span className="home-collection-icon" aria-hidden>
                  <Icon />
                </span>
                <span className="home-collection-body">
                  <span className="home-collection-name">{group.title}</span>
                  <span className="home-collection-meta">
                    {group.total} {group.total === 1 ? "document" : "documents"}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="home-card-body">
          <p className="home-muted">
            Connect a source to create library sections from your folders and documents.
          </p>
        </div>
      )}
    </section>
  );
}
