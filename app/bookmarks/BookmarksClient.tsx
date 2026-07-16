"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Bookmark, BookOpen, FileText, StickyNote, Trash2 } from "lucide-react";
import {
  formatBookmarkAge,
  loadBookmarks,
  removeBookmark,
  subscribeBookmarks,
} from "@/lib/bookmarks";
import type { Bookmark as BookmarkItem, BookmarkKind } from "@/lib/bookmarks";
import { ContentHeader, ContentPage } from "@/components/layout/ContentPage";
import ContentTabs from "@/components/layout/ContentTabs";
import { Button } from "@/components/ui/button";
import { ContentEmptyState, ContentPanel, ContentRow } from "@/components/ui/content-primitives";
import styles from "./Bookmarks.module.css";

// ---- Tabs ------------------------------------------------------------------

type TabId = "all" | BookmarkKind;

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
  const tabs = useMemo(
    () => [
      { id: "all" as const, label: "All", count: allBookmarks.length, panelId: "bookmarks-panel" },
      {
        id: "document" as const,
        label: "Documents",
        count: allBookmarks.filter((bookmark) => bookmark.kind === "document").length,
        panelId: "bookmarks-panel",
      },
      {
        id: "note" as const,
        label: "Notes",
        count: allBookmarks.filter((bookmark) => bookmark.kind === "note").length,
        panelId: "bookmarks-panel",
      },
    ],
    [allBookmarks]
  );

  return (
    <ContentPage width="standard">
      <ContentHeader
        icon={<Bookmark />}
        title="Bookmarks"
        description="Quick access to important documents."
      />
      <ContentTabs items={tabs} value={tab} onValueChange={setTab} label="Bookmark categories" />

      <div
        id="bookmarks-panel"
        className={styles.panel}
        role="tabpanel"
        aria-label={`${tabs.find((item) => item.id === tab)?.label ?? "All"} bookmarks`}
      >
        {filtered.length === 0 ? (
          <ContentEmptyState
            icon={<Bookmark aria-hidden />}
            title={hasNoBookmarks ? "Start a shortlist" : "Nothing in this view"}
            description={
              hasNoBookmarks
                ? "Open a document you want to keep close, then choose Bookmark."
                : "Try another bookmark category to see the items you saved there."
            }
            action={
              hasNoBookmarks ? (
                <Button asChild size="sm">
                  <Link href="/library">
                    <BookOpen aria-hidden /> Browse Library
                  </Link>
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setTab("all")}>
                  Show all bookmarks
                </Button>
              )
            }
          />
        ) : (
          <ContentPanel variant="plain">
            <ul className={styles.list} aria-label="Bookmarks">
              {filtered.map((bm) => (
                <li key={bm.href} className={styles.item}>
                  <ContentRow
                    className={styles.row}
                    leading={
                      bm.kind === "note" ? <StickyNote aria-hidden /> : <FileText aria-hidden />
                    }
                    title={
                      <Link href={bm.href} className={styles.titleLink}>
                        {bm.title}
                      </Link>
                    }
                    description={bm.href}
                    metadata={
                      <span className={styles.metadata}>
                        <span className={styles.kind}>{bm.kind}</span>
                        <span className={styles.time}>{formatBookmarkAge(bm.addedAt)}</span>
                      </span>
                    }
                    actions={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={styles.remove}
                        onClick={() => void removeBookmark(bm.href).catch(() => {})}
                        aria-label={`Remove bookmark: ${bm.title}`}
                        title="Remove bookmark"
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    }
                  />
                </li>
              ))}
            </ul>
          </ContentPanel>
        )}
      </div>
    </ContentPage>
  );
}
