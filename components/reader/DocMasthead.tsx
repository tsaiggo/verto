// Article masthead: eyebrow (category / date / reading time), title, dek, author, tags, cover.
import type { ContentFileNode } from "@/lib/content-source";
import { formatDate } from "@/lib/format";
import { formatReadingTime } from "@/lib/reading-time";
import CopyPageButton from "@/components/reader/CopyPageButton";
import { BookmarkButton } from "@/components/reader/BookmarkButton";

export function DocMasthead({
  file,
  category,
  readingMinutes,
}: {
  file: ContentFileNode;
  category?: string;
  readingMinutes: number;
}) {
  // One mono eyebrow line: [category pill] · updated date · reading time.
  const dateLabel = file.date
    ? formatDate(file.date)
    : `Updated ${formatDate(file.updated ?? new Date(file.mtime).toISOString())}`;
  const readingLabel = formatReadingTime(readingMinutes);
  const authorInitial = file.author?.trim().charAt(0).toUpperCase();
  return (
    <>
      <CopyPageButton>
        <BookmarkButton href={file.href} title={file.title} kind="document" />
      </CopyPageButton>
      <header className="doc-header">
        <div className="doc-eyebrow">
          {category && <span className="doc-eyebrow-pill">{category}</span>}
          <span>{dateLabel}</span>
          <span className="doc-eyebrow-dot" aria-hidden>
            ·
          </span>
          <span>{readingLabel}</span>
        </div>
        {file.draft && (
          <span className="draft-badge" aria-label="Draft document">
            Draft
          </span>
        )}
        <h1 className="doc-title">{file.title}</h1>
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
            {file.tags.map((tag) => (
              <a key={tag} href={`/read/tags/${encodeURIComponent(tag)}`} className="tag-chip">
                {tag}
              </a>
            ))}
          </div>
        )}
      </header>
      {file.cover ? (
        <div className="article-cover">
          {/* Static cover image. Use a plain <img> so the path can be a remote
              URL or a relative content path without configuring Next's image
              optimizer per source. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={file.cover} alt="" loading="lazy" />
        </div>
      ) : (
        // Decorative editorial band when the doc has no cover image.
        <div className="doc-hero" aria-hidden />
      )}
    </>
  );
}
