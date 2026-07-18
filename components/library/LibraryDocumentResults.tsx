"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Bookmark, FileText } from "lucide-react";
import { toast } from "sonner";
import { loadBookmarks, toggleBookmark, type BookmarkKind } from "@/lib/bookmarks";
import { readingStatusLabel } from "@/lib/reading-state";
import type { LibraryDoc, LibraryKind } from "@/components/library/LibraryBrowser";
import { Button } from "@/components/ui/button";
import { ContentEmptyState } from "@/components/ui/content-primitives";

interface LibraryDocumentResultsProps {
  rows: LibraryDoc[];
  progressMap: ReadonlyMap<string, number>;
  bookmarkedHrefs: ReadonlySet<string>;
  emptyMessage: string;
  onClearFilters?: () => void;
}

function toBookmarkKind(kind: LibraryKind): BookmarkKind {
  return kind === "note" ? "note" : "document";
}

export default function LibraryDocumentResults({
  rows,
  progressMap,
  bookmarkedHrefs,
  emptyMessage,
  onClearFilters,
}: LibraryDocumentResultsProps) {
  const bookmarkRequests = useRef(new Set<string>());
  const [pendingHrefs, setPendingHrefs] = useState<ReadonlySet<string>>(() => new Set());

  async function handleBookmark(document: LibraryDoc, bookmarked: boolean) {
    if (bookmarkRequests.current.has(document.href)) return;

    const shouldBeBookmarked = !bookmarked;
    bookmarkRequests.current.add(document.href);
    setPendingHrefs((current) => new Set(current).add(document.href));
    try {
      await toggleBookmark({
        href: document.href,
        title: document.title,
        kind: toBookmarkKind(document.kind),
        addedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const appliedLocally =
        loadBookmarks().some((bookmark) => bookmark.href === document.href) === shouldBeBookmarked;
      if (!appliedLocally) {
        toast.error("Bookmark was not updated", {
          description:
            error instanceof Error
              ? error.message
              : "Check that local storage is available, then retry.",
        });
      }
    } finally {
      bookmarkRequests.current.delete(document.href);
      setPendingHrefs((current) => {
        const next = new Set(current);
        next.delete(document.href);
        return next;
      });
    }
  }
  if (rows.length === 0) {
    return (
      <ContentEmptyState
        compact
        className="lib-empty"
        icon={<FileText aria-hidden />}
        title="No documents to show"
        description={emptyMessage}
        action={
          onClearFilters ? (
            <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="lib-table" role="list" aria-label="Documents">
      <div className="lib-thead" aria-hidden="true">
        <span>Title</span>
        <span>Source</span>
        <span>Updated</span>
      </div>
      {rows.map((document) => {
        const progress = progressMap.get(document.href);
        const status = progress === undefined ? "" : readingStatusLabel(progress);
        const meta = document.tags.length
          ? document.tags.map((tag) => `#${tag}`).join(" ")
          : "Document";
        const bookmarked = bookmarkedHrefs.has(document.href);

        return (
          <div key={`${document.href}:${document.title}`} className="lib-row-wrap" role="listitem">
            <Link href={document.href} className="lib-row">
              <span className="lib-cell-title">
                <FileText className="lib-row-icon" aria-hidden />
                <span className="lib-title-text">
                  <strong>
                    {document.title}
                    <span className="lib-ext">{document.ext}</span>
                  </strong>
                  <small>{status ? `${status} - ${meta}` : meta}</small>
                </span>
              </span>
              <span className="lib-cell-source">{document.section}</span>
              <span className="lib-cell-updated">{document.updatedLabel}</span>
            </Link>
            <button
              type="button"
              className={`lib-bm-btn${bookmarked ? " is-active" : ""}`}
              onClick={() => void handleBookmark(document, bookmarked)}
              aria-label={`${bookmarked ? "Remove bookmark" : "Bookmark"}: ${document.title}`}
              aria-pressed={bookmarked}
              disabled={pendingHrefs.has(document.href)}
              aria-busy={pendingHrefs.has(document.href)}
            >
              <Bookmark size={13} aria-hidden fill={bookmarked ? "currentColor" : "none"} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
