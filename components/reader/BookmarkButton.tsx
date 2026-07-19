"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { isBookmarked, loadBookmarks, subscribeBookmarks, toggleBookmark } from "@/lib/bookmarks";
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
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    const shouldBeBookmarked = !bookmarked;

    try {
      await toggleBookmark({ href, title, kind, addedAt: new Date().toISOString() });
    } catch {
      const appliedLocally =
        loadBookmarks().some((bookmark) => bookmark.href === href) === shouldBeBookmarked;
      if (!appliedLocally) {
        toast.error(
          shouldBeBookmarked ? "Couldn't bookmark this document" : "Couldn't remove bookmark",
          {
            description: shouldBeBookmarked
              ? "The document is not bookmarked. Check local storage, then retry."
              : "The bookmark is still saved. Check local storage, then retry.",
          }
        );
      }
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      className={`doc-copybtn${bookmarked ? " is-active" : ""}`}
      disabled={pending}
      aria-busy={pending}
      onClick={() => void toggle()}
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark this document"}
      aria-pressed={bookmarked}
    >
      <Bookmark size={14} aria-hidden fill={bookmarked ? "currentColor" : "none"} />
      <span className="doc-copybtn-label doc-copybtn-label--wide">
        {bookmarked ? "Bookmarked" : "Bookmark"}
      </span>
    </button>
  );
}
