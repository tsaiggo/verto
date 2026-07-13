"use client";

import Link from "next/link";
import { Bookmark, FileText } from "lucide-react";
import { toggleBookmark, type BookmarkKind } from "@/lib/bookmarks";
import { readingStatusLabel } from "@/lib/reading-state";
import type { LibraryDoc, LibraryKind } from "@/components/library/LibraryBrowser";

interface LibraryDocumentResultsProps {
  rows: LibraryDoc[];
  progressMap: ReadonlyMap<string, number>;
  bookmarkedHrefs: ReadonlySet<string>;
  emptyMessage: string;
}

function toBookmarkKind(kind: LibraryKind): BookmarkKind {
  return kind === "note" ? "note" : "document";
}

export default function LibraryDocumentResults({
  rows,
  progressMap,
  bookmarkedHrefs,
  emptyMessage,
}: LibraryDocumentResultsProps) {
  if (rows.length === 0) {
    return (
      <div className="lib-empty">
        <FileText aria-hidden />
        <p>{emptyMessage}</p>
      </div>
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
              onClick={() =>
                toggleBookmark({
                  href: document.href,
                  title: document.title,
                  kind: toBookmarkKind(document.kind),
                  addedAt: new Date().toISOString(),
                })
              }
              aria-label={`${bookmarked ? "Remove bookmark" : "Bookmark"}: ${document.title}`}
              aria-pressed={bookmarked}
            >
              <Bookmark size={13} aria-hidden fill={bookmarked ? "currentColor" : "none"} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
