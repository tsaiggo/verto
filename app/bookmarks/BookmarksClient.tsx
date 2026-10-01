"use client";

import { useMemo, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import Link from "next/link";
import { Bookmark, BookOpen, FileText } from "lucide-react";
import { loadBookmarks, removeBookmark, subscribeBookmarks } from "@/lib/bookmarks";
import type { Bookmark as BookmarkItem, BookmarkKind } from "@/lib/bookmarks";
import PageHeader from "@/components/layout/PageHeader";
import PageFrame from "@/components/layout/PageFrame";
import styles from "@/app/bookmarks/Bookmarks.module.css";

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
  const [actionError, setActionError] = useState<string | null>(null);

  const snap = useSyncExternalStore(subscribeBookmarks, getSnapshot, getServerSnapshot);
  const allBookmarks = useMemo(() => parseSnap(snap), [snap]);

  const filtered = useMemo(
    () => (tab === "all" ? allBookmarks : allBookmarks.filter((b) => b.kind === tab)),
    [allBookmarks, tab]
  );
  const hasNoBookmarks = allBookmarks.length === 0;

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = TABS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const next = TABS[nextIndex];
    if (!next) return;
    setTab(next.id);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#bookmark-tab-${next.id}`)
      ?.focus();
  }

  return (
    <>
      <PageHeader
        title="Bookmarks"
        subtitle="Quick access to important documents."
        frame="standard"
        flush
      />

      <PageFrame
        size="standard"
        className={`v-tabs ${styles.tabs}`}
        role="tablist"
        aria-label="Bookmark type"
      >
        {TABS.map((t, index) => (
          <button
            key={t.id}
            id={`bookmark-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            aria-controls="bookmark-panel"
            tabIndex={t.id === tab ? 0 : -1}
            className={`v-tab${t.id === tab ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
            onKeyDown={(event) => onTabKeyDown(event, index)}
          >
            {t.label}
          </button>
        ))}
      </PageFrame>

      <PageFrame
        size="standard"
        className={`v-page ${styles.body}`}
        id="bookmark-panel"
        role="tabpanel"
        aria-labelledby={`bookmark-tab-${tab}`}
        tabIndex={0}
      >
        {actionError ? (
          <p className={styles.notice} role="alert">
            {actionError}
          </p>
        ) : null}
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.mark} aria-hidden>
              <Bookmark />
            </span>
            <div>
              <h2>{hasNoBookmarks ? "Start a shortlist" : "Nothing in this view"}</h2>
              <p>
                {hasNoBookmarks
                  ? "Open a document you want to keep close, then choose Bookmark."
                  : "Try another bookmark category to see the items you saved there."}
              </p>
            </div>
            {hasNoBookmarks ? (
              <Link href="/library" className={`v-btn v-btn--primary ${styles.emptyAction}`}>
                <BookOpen aria-hidden /> Browse Library
              </Link>
            ) : (
              <button
                type="button"
                className={`v-btn v-btn--sm ${styles.emptyAction}`}
                onClick={() => setTab("all")}
              >
                Show all bookmarks
              </button>
            )}
          </div>
        ) : (
          <ul className={styles.list} aria-label="Saved bookmarks">
            {filtered.map((bm) => (
              <li key={bm.href}>
                <div className={styles.rowWrap}>
                  <Link href={bm.href} className={styles.row}>
                    <FileText className={styles.icon} aria-hidden />
                    <span className={styles.copy}>
                      <span className={styles.title}>{bm.title}</span>
                      <span className={styles.path}>{bm.href}</span>
                    </span>
                    <span className={styles.kind}>{bm.kind}</span>
                    <span className={styles.time}>{relativeTime(bm.addedAt)}</span>
                  </Link>
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => {
                      setActionError(null);
                      void removeBookmark(bm.href).catch(() =>
                        setActionError(
                          "Verto couldn’t update this bookmark. Your document was not changed."
                        )
                      );
                    }}
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
      </PageFrame>
    </>
  );
}
