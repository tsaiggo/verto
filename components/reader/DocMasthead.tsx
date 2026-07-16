// Editorial article masthead: metadata, title, dek, author, tags, and actions.
import type { ContentFileNode } from "@/lib/content-source";
import { FileText } from "lucide-react";
import { formatDate } from "@/lib/format";
import { formatReadingTime } from "@/lib/reading-time";
import CopyPageButton from "@/components/reader/CopyPageButton";
import { BookmarkButton } from "@/components/reader/BookmarkButton";
import { AddToCollectionButton } from "@/components/reader/AddToCollectionButton";
import ReadingSettings from "@/components/ui/ReadingSettings";

type DocMastheadMode = "library" | "help";

export function DocMasthead({
  file,
  category,
  readingMinutes,
  mode = "library",
}: {
  file: ContentFileNode;
  category?: string;
  readingMinutes: number;
  mode?: DocMastheadMode;
}) {
  // One mono eyebrow line: [category pill] · updated date · reading time.
  const dateLabel = file.date
    ? formatDate(file.date)
    : `Updated ${formatDate(file.updated ?? new Date(file.mtime).toISOString())}`;
  const readingLabel = formatReadingTime(readingMinutes);
  const authorInitial = file.author?.trim().charAt(0).toUpperCase();
  return (
    <header className="doc-header" data-page-identity>
      <div className="doc-identity">
        <span className="doc-identity-icon" aria-hidden>
          <FileText />
        </span>
        <div className="doc-identity-copy">
          <div className="doc-eyebrow">
            {category && <span className="doc-eyebrow-pill">{category}</span>}
            <span>{dateLabel}</span>
            <span className="doc-eyebrow-dot" aria-hidden>
              ·
            </span>
            <span>{readingLabel}</span>
          </div>
          <div className="doc-title-row">
            <h1 className="doc-title">{file.title}</h1>
            {file.draft && (
              <span className="draft-badge" aria-label="Draft document">
                Draft
              </span>
            )}
          </div>
          {file.dek && <p className="doc-dek">{file.dek}</p>}
          {file.author && (
            <div className="doc-authorline">
              <span className="doc-avatar" aria-hidden>
                {authorInitial}
              </span>
              <span>By {file.author}</span>
            </div>
          )}
          {file.tags && file.tags.length > 0 && (
            <div className="doc-tags tag-chip-group">
              {file.tags.map((tag) =>
                mode === "help" ? (
                  <span key={tag} className="tag-chip">
                    {tag}
                  </span>
                ) : (
                  <a key={tag} href={`/read/tags/${encodeURIComponent(tag)}`} className="tag-chip">
                    {tag}
                  </a>
                )
              )}
            </div>
          )}
        </div>
      </div>

      <CopyPageButton>
        {mode === "library" ? (
          <>
            <BookmarkButton href={file.href} title={file.title} kind="document" />
            <AddToCollectionButton href={file.href} title={file.title} mobileSheet />
          </>
        ) : null}
        <ReadingSettings />
      </CopyPageButton>
    </header>
  );
}

export function DocCover({ file }: { file: ContentFileNode }) {
  if (!file.cover) return null;

  return (
    <div className="article-cover">
      {/* Static cover image. Use a plain <img> so the path can be a remote URL
          or a relative content path without configuring Next's optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={file.cover} alt="" loading="lazy" />
    </div>
  );
}
