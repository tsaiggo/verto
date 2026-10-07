"use client";

import Link from "next/link";
import { Bookmark, FileText, SearchX, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import styles from "@/components/library/Library.module.css";
import { Button } from "@/components/ui/button";
import { toggleBookmark, type BookmarkKind } from "@/lib/bookmarks";
import { readingStatusLabel } from "@/lib/reading-state";
import type { LibraryDoc, LibraryKind, LibraryViewId } from "@/components/library/LibraryBrowser";
import type { LibraryDisplay } from "@/components/library/LibraryBrowser";
import LibraryShelfResults from "@/components/library/LibraryShelfResults";
import LibraryCoverImage from "@/components/library/LibraryCoverImage";

interface LibraryDocumentResultsProps {
  display?: LibraryDisplay;
  rows: LibraryDoc[];
  progressMap: ReadonlyMap<string, number>;
  bookmarkedHrefs: ReadonlySet<string>;
  emptyMessage: string;
  state: "idle" | "loading" | "ready" | "error";
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  activeView: LibraryViewId;
  libraryDocumentCount: number;
}

function toBookmarkKind(kind: LibraryKind): BookmarkKind {
  return kind === "note" ? "note" : "document";
}

const EMPTY_VIEW_COPY: Record<LibraryViewId, { title: string; copy: string }> = {
  all: {
    title: "No active documents",
    copy: "This library only contains archived documents. Open Archives to browse them.",
  },
  notes: {
    title: "No notes yet",
    copy: "Markdown notes in this library will appear here.",
  },
  drafts: {
    title: "No drafts",
    copy: "Documents marked as drafts will appear here.",
  },
  archives: {
    title: "No archived documents",
    copy: "Documents you archive will remain available here.",
  },
};

interface EmptyStateDescriptor {
  title: string;
  copy: string;
  icon: "error" | "search" | "file";
  action: { kind: "clear" | "source" | "note"; label: string } | null;
}

function resolveEmptyState({
  state,
  hasActiveFilters,
  activeView,
  libraryDocumentCount,
  emptyMessage,
}: Pick<
  LibraryDocumentResultsProps,
  "state" | "hasActiveFilters" | "activeView" | "libraryDocumentCount" | "emptyMessage"
>): EmptyStateDescriptor {
  if (state === "error") {
    return {
      title: "This folder couldn’t be read",
      copy: emptyMessage,
      icon: "error",
      action: { kind: "source", label: "Choose another folder" },
    };
  }
  if (hasActiveFilters) {
    return {
      title: "No matching documents",
      copy: "Try another search, section, or tag to widen the document list.",
      icon: "search",
      action: { kind: "clear", label: "Clear filters" },
    };
  }
  if (state === "ready" && libraryDocumentCount === 0) {
    return {
      title: "No Markdown files found",
      copy: emptyMessage,
      icon: "file",
      action: { kind: "source", label: "Manage source" },
    };
  }
  if (libraryDocumentCount > 0) {
    return {
      ...EMPTY_VIEW_COPY[activeView],
      icon: "file",
      action: activeView === "notes" ? { kind: "note", label: "New note" } : null,
    };
  }
  return {
    title: "Your library is ready for its first document",
    copy: emptyMessage,
    icon: "file",
    action: { kind: "source", label: "Connect a folder" },
  };
}

function EmptyDocumentState(
  props: Pick<
    LibraryDocumentResultsProps,
    | "state"
    | "hasActiveFilters"
    | "onClearFilters"
    | "activeView"
    | "libraryDocumentCount"
    | "emptyMessage"
  >
) {
  const descriptor = resolveEmptyState(props);
  const error = descriptor.icon === "error";

  return (
    <div className={styles.state} role={error ? "alert" : "status"}>
      <div className={styles.stateInner}>
        <span className={styles.stateIcon} aria-hidden>
          {error ? <TriangleAlert /> : descriptor.icon === "search" ? <SearchX /> : <FileText />}
        </span>
        <h2 className={styles.stateTitle}>{descriptor.title}</h2>
        <p className={styles.stateCopy}>{descriptor.copy}</p>
        {descriptor.action ? (
          <div className={styles.stateActions}>
            {descriptor.action.kind === "clear" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={styles.clearButton}
                onClick={props.onClearFilters}
              >
                {descriptor.action.label}
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className={styles.stateAction}>
                <Link
                  href={descriptor.action.kind === "note" ? "/editor" : "/integrations#local-files"}
                >
                  {descriptor.action.label}
                </Link>
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function LibraryDocumentResults({
  display = "list",
  rows,
  progressMap,
  bookmarkedHrefs,
  emptyMessage,
  state,
  hasActiveFilters,
  onClearFilters,
  activeView,
  libraryDocumentCount,
}: LibraryDocumentResultsProps) {
  if (state === "loading") {
    return (
      <div className={styles.loadingRows} role="status" aria-label="Loading documents">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className={styles.loadingRow} aria-hidden>
            <span className={styles.skeleton}>
              <span className={styles.skeletonLine} />
              <span className={styles.skeletonDescription} />
              <span className={styles.skeletonShort} />
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyDocumentState
        state={state}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        activeView={activeView}
        libraryDocumentCount={libraryDocumentCount}
        emptyMessage={emptyMessage}
      />
    );
  }

  if (display === "shelf") {
    return (
      <LibraryShelfResults
        rows={rows}
        progressMap={progressMap}
        bookmarkedHrefs={bookmarkedHrefs}
      />
    );
  }

  return (
    <div className={styles.table} role="list" aria-label="Documents">
      {rows.map((document) => {
        const progress = progressMap.get(document.href);
        const status =
          progress === undefined
            ? document.kind === "draft"
              ? "Draft"
              : document.kind === "archive"
                ? "Archived"
                : ""
            : readingStatusLabel(progress);
        const bookmarked = bookmarkedHrefs.has(document.href);

        return (
          <div
            key={`${document.href}:${document.title}`}
            className={styles.rowWrap}
            role="listitem"
          >
            <Link href={document.href} className={styles.row}>
              <span className={styles.articleCopy}>
                <strong className={styles.articleTitle}>{document.title}</strong>
                {document.description ? (
                  <span className={styles.articleDescription}>{document.description}</span>
                ) : null}
                <span className={styles.articleMeta} data-article-meta>
                  <span>
                    <span className={styles.srOnly}>Source: </span>
                    {document.section}
                  </span>
                  {document.author ? <span>{document.author}</span> : null}
                  <span>
                    <span className={styles.srOnly}>Updated: </span>
                    <time dateTime={document.updatedISO || undefined}>{document.updatedLabel}</time>
                  </span>
                  <span className={styles.articleFormat}>{document.ext.replace(/^\./, "")}</span>
                  {status ? <span>{status}</span> : null}
                </span>
              </span>
              {document.cover ? (
                <LibraryCoverImage
                  key={document.cover}
                  src={document.cover}
                  className={styles.articleThumbnail}
                />
              ) : null}
            </Link>
            <button
              type="button"
              className={`${styles.bookmark}${bookmarked ? ` ${styles.bookmarkActive}` : ""}`}
              onClick={() =>
                void toggleBookmark({
                  href: document.href,
                  title: document.title,
                  kind: toBookmarkKind(document.kind),
                  addedAt: new Date().toISOString(),
                }).catch(() => {
                  toast.error("Couldn’t update this bookmark", {
                    description: "Your document is unchanged. Try again in a moment.",
                  });
                })
              }
              aria-label={`${bookmarked ? "Remove bookmark" : "Bookmark"}: ${document.title}`}
              aria-pressed={bookmarked}
            >
              <Bookmark size={16} aria-hidden fill={bookmarked ? "currentColor" : "none"} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
