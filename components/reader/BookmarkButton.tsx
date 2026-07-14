"use client";

import { useSyncExternalStore } from "react";
import { Bookmark } from "lucide-react";
import { isBookmarked, subscribeBookmarks, toggleBookmark } from "@/lib/bookmarks";
import type { BookmarkKind } from "@/lib/bookmarks";

/**
 * Bookmark toggle button for the reader masthead.
 *
 * Uses `useSyncExternalStore` so the filled/outline icon updates immediately
 * when the same document is bookmarked from another tab or the Library.
 */
export function BookmarkButton({
  href,
  title,
  kind = "document",
}: {
  href: string;
  title: string;
  kind?: BookmarkKind;
}) {
  const bookmarked = useSyncExternalStore(
    subscribeBookmarks,
    () => isBookmarked(href),
    () => false
  );

  return (
    <button
      type="button"
      className={`doc-copybtn${bookmarked ? " is-active" : ""}`}
      onClick={() =>
        void toggleBookmark({ href, title, kind, addedAt: new Date().toISOString() }).catch(
          () => {}
        )
      }
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark this document"}
      aria-pressed={bookmarked}
    >
      <Bookmark size={14} aria-hidden fill={bookmarked ? "currentColor" : "none"} />
      {bookmarked ? "Bookmarked" : "Bookmark"}
    </button>
  );
}
