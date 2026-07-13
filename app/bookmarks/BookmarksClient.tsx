"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Bookmark, BookOpen, FileText } from "lucide-react";
import { loadBookmarks, subscribeBookmarks, toggleBookmark } from "@/lib/bookmarks";
import type { Bookmark as BookmarkItem, BookmarkKind } from "@/lib/bookmarks";
import PageHeader from "@/components/layout/PageHeader";

// ---- Tabs ------------------------------------------------------------------

type TabId = "all" | BookmarkKind;

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "document", label: "Documents" },
  { id: "note", label: "Notes" },
];

// ---- Snapshot helpers (stable references — no new function per render) -----

function getSnapshot(): string {
  return JSON.stringify(loadBookmarks());
}

function getServerSnapshot(): string {
  return "[]";
}

function parseSnap(snap: string): BookmarkItem[] {
  try {
    return JSON.parse(snap) as BookmarkItem[];
  } catch {
    return [];
  }
}

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "recently";
  }
}

// ---- Component -------------------------------------------------------------

/**
 * Client-side bookmark list with tab filtering.
 * Reads from the real bookmark store via `useSyncExternalStore` so the page
 * updates immediately when a bookmark is added or removed from the reader.
 */
export default function BookmarksClient() {
  const [tab, setTab] = useState<TabId>("all");

  const snap = useSyncExternalStore(subscribeBookmarks, getSnapshot, getServerSnapshot);
  const allBookmarks = useMemo(() => parseSnap(snap), [snap]);

  const filtered = useMemo(
    () => (tab === "all" ? allBookmarks : allBookmarks.filter((b) => b.kind === tab)),
    [allBookmarks, tab]
  );
  const hasNoBookmarks = allBookmarks.length === 0;

  return (
    <>
      <PageHeader title="Bookmarks" subtitle="Quick access to important documents." flush />

      <div className="v-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            className={`v-tab${t.id === tab ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="v-page">
        {filtered.length === 0 ? (
          <div className="bm-empty">
            <span className="bm-empty-mark" aria-hidden>
              <Bookmark />
            </span>
            <div className="bm-empty-copy">
              <h2>{hasNoBookmarks ? "Start a shortlist" : "Nothing in this view"}</h2>
              <p>
                {hasNoBookmarks
                  ? "Open a document you want to keep close, then choose Bookmark."
                  : "Try another bookmark category to see the items you saved there."}
              </p>
            </div>
            {hasNoBookmarks ? (
              <Link href="/library" className="v-btn v-btn--primary bm-empty-action">
                <BookOpen aria-hidden /> Browse Library
              </Link>
            ) : (
              <button
                type="button"
                className="v-btn v-btn--sm bm-empty-action"
                onClick={() => setTab("all")}
              >
                Show all bookmarks
              </button>
            )}
          </div>
        ) : (
          <ul className="bm-list">
            {filtered.map((bm) => (
              <li key={bm.href}>
                <div className="bm-row-wrap">
                  <Link href={bm.href} className="bm-row">
                    <FileText className="bm-icon" aria-hidden />
                    <span className="bm-main">
                      <span className="bm-title">{bm.title}</span>
                      <span className="bm-path">{bm.href}</span>
                    </span>
                    <span className="bm-workspace">{bm.kind}</span>
                    <span className="bm-time">{relativeTime(bm.addedAt)}</span>
                  </Link>
                  <button
                    type="button"
                    className="bm-remove-btn"
                    onClick={() =>
                      toggleBookmark({
                        href: bm.href,
                        title: bm.title,
                        kind: bm.kind,
                        addedAt: bm.addedAt,
                      })
                    }
                    aria-label={`Remove bookmark: ${bm.title}`}
                    title="Remove bookmark"
                  >
                    <Bookmark size={14} aria-hidden fill="currentColor" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
