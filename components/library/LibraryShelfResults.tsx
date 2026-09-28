"use client";

import Link from "next/link";
import { useState } from "react";
import { Bookmark, FileText } from "lucide-react";
import { toast } from "sonner";
import type { LibraryDoc, LibraryKind } from "@/components/library/LibraryBrowser";
import styles from "@/components/library/Library.module.css";
import { toggleBookmark, type BookmarkKind } from "@/lib/bookmarks";
import { readingStatusLabel } from "@/lib/reading-state";

interface LibraryShelfResultsProps {
  rows: LibraryDoc[];
  progressMap: ReadonlyMap<string, number>;
  bookmarkedHrefs: ReadonlySet<string>;
}

function bookmarkKind(kind: LibraryKind): BookmarkKind {
  return kind === "note" ? "note" : "document";
}

function groupBySection(rows: LibraryDoc[]): [string, LibraryDoc[]][] {
  const groups = new Map<string, LibraryDoc[]>();
  for (const document of rows) {
    const group = groups.get(document.section) ?? [];
    group.push(document);
    groups.set(document.section, group);
  }
  return Array.from(groups);
}

function CoverImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // Frontmatter covers may be remote or served by a connected local source.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={styles.shelfCoverImage}
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function ShelfCard({
  document,
  progress,
  bookmarked,
}: {
  document: LibraryDoc;
  progress: number | undefined;
  bookmarked: boolean;
}) {
  const readingProgress = progress === undefined ? null : Math.min(100, Math.max(0, progress));
  const status = readingProgress === null ? null : readingStatusLabel(readingProgress);

  return (
    <div className={styles.shelfCard} role="listitem">
      <Link href={document.href} className={styles.shelfLink}>
        <span className={styles.shelfCover}>
          <span className={styles.shelfCoverFallback} aria-hidden>
            <FileText />
            <span className={styles.shelfCoverLines}>
              <span />
              <span />
              <span />
            </span>
            <span className={styles.shelfCoverType}>
              {document.kind === "note" ? "Note" : "Document"}
            </span>
          </span>
          {document.cover ? <CoverImage key={document.cover} src={document.cover} /> : null}
          {readingProgress !== null ? (
            <span className={styles.shelfProgressTrack} aria-hidden>
              <span style={{ width: `${readingProgress}%` }} />
            </span>
          ) : null}
        </span>
        <span className={styles.shelfCardCopy}>
          <strong>{document.title}</strong>
          <span>{document.author || document.section}</span>
          <small>
            {status ? `${status} · ` : ""}
            {document.updatedLabel}
          </small>
        </span>
      </Link>
      <button
        type="button"
        className={`${styles.shelfBookmark}${bookmarked ? ` ${styles.shelfBookmarkActive}` : ""}`}
        aria-label={`${bookmarked ? "Remove bookmark" : "Bookmark"}: ${document.title}`}
        aria-pressed={bookmarked}
        onClick={() =>
          void toggleBookmark({
            href: document.href,
            title: document.title,
            kind: bookmarkKind(document.kind),
            addedAt: new Date().toISOString(),
          }).catch(() => {
            toast.error("Couldn’t update this bookmark", {
              description: "Your document is unchanged. Try again in a moment.",
            });
          })
        }
      >
        <Bookmark aria-hidden fill={bookmarked ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

export default function LibraryShelfResults({
  rows,
  progressMap,
  bookmarkedHrefs,
}: LibraryShelfResultsProps) {
  return (
    <div className={styles.shelfResults}>
      {groupBySection(rows).map(([section, documents]) => (
        <section key={section} className={styles.shelfSection} aria-label={section}>
          <header className={styles.shelfSectionHeader}>
            <h2>{section}</h2>
            <span>{documents.length}</span>
          </header>
          <div className={styles.shelfGrid} role="list" aria-label={`${section} documents`}>
            {documents.map((document) => (
              <ShelfCard
                key={`${document.href}:${document.title}`}
                document={document}
                progress={progressMap.get(document.href)}
                bookmarked={bookmarkedHrefs.has(document.href)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
