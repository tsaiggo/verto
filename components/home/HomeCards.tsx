"use client";

import Link from "next/link";
import {
  Bookmark,
  BookOpen,
  FileText,
  FolderClosed,
  Inbox as InboxIcon,
  PencilLine,
  Plus,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";
import type { LibraryGroup, RecentDoc } from "@/components/home/home-data";
import { getInboxAttentionCount, loadInbox, subscribeInbox, type InboxItem } from "@/lib/inbox";

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
          <Sparkles aria-hidden />
          Agent Highlights
        </span>
      </div>
      <div className="v-card-divider" />
      <div className="home-card-body">
        <p className="home-muted">Use Agent to analyze, draft, and search across your workspace.</p>
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

function subscribe(callback: () => void) {
  return subscribeInbox(callback);
}

function getInboxSnapshot() {
  return JSON.stringify(loadInbox());
}

function getServerInboxSnapshot() {
  return JSON.stringify({ items: [] });
}

function parseInbox(snapshot: string): InboxItem[] {
  try {
    const parsed: unknown = JSON.parse(snapshot);
    if (parsed && typeof parsed === "object" && "items" in parsed && Array.isArray(parsed.items)) {
      return parsed.items as InboxItem[];
    }
  } catch {
    return [];
  }
  return [];
}

export function InboxTriageCard() {
  const snapshot = useSyncExternalStore(subscribe, getInboxSnapshot, getServerInboxSnapshot);
  const items = useMemo(() => parseInbox(snapshot), [snapshot]);
  const unread = items.filter((item) => item.status === "unread").length;
  const reading = items.filter((item) => item.status === "reading").length;
  const attention = getInboxAttentionCount(items);

  return (
    <section className="v-card home-card">
      <div className="v-cardhead">
        <span className="v-cardhead-title">
          <InboxIcon aria-hidden />
          Inbox
        </span>
      </div>
      <div className="v-card-divider" />
      {attention > 0 ? (
        <ul className="home-triage">
          {unread > 0 && (
            <li className="home-triage-row">
              <Bookmark className="home-triage-icon" aria-hidden />
              <span className="home-triage-title">
                {unread} unread {unread === 1 ? "article" : "articles"}
              </span>
            </li>
          )}
          {reading > 0 && (
            <li className="home-triage-row">
              <BookOpen className="home-triage-icon" aria-hidden />
              <span className="home-triage-title">
                {reading} article{reading === 1 ? "" : "s"} in progress
              </span>
            </li>
          )}
        </ul>
      ) : (
        <div className="home-card-body">
          <p className="home-muted">
            Your inbox is clear. Add an RSS or Atom subscription to begin.
          </p>
        </div>
      )}
      <div className="v-card-divider" />
      <div className="home-card-foot">
        <Link href="/inbox" className="v-cardhead-link">
          Open inbox
        </Link>
      </div>
    </section>
  );
}

/* ---- Recent Collections ------------------------------------------------- */

const COLLECTION_ICONS: LucideIcon[] = [Sparkles, PencilLine, FileText, FolderClosed, Bookmark];

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
