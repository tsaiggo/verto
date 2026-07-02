import Link from "next/link";
import { FileText } from "lucide-react";
import type { ContentFileNode } from "@/lib/content-source";
import { formatDate } from "@/lib/format";

/**
 * Shared editorial list for "a set of documents to open" surfaces (the tag and
 * status filter pages). Renders each file as a `.dir-index` card, the same
 * document-row language the directory index uses, so every list-of-documents
 * view in the app reads consistently: a hairline card, a hover lift, a clean
 * title + date row, and a two-line description. Every result here is a file,
 * so all rows carry the FileText glyph.
 *
 * Replaces the raw inline-styled `<ul>` the tag/status pages used to inline;
 * that markup lived inside `.prose`, so it also inherited the prose list dot.
 * The `.dir-index` classes reset the list styling, removing that stray bullet.
 */
export default function DocumentList({ files }: { files: ContentFileNode[] }) {
  return (
    <ul className="dir-index">
      {files.map((file) => {
        const dateLabel = file.date
          ? formatDate(file.date)
          : `Updated ${formatDate(new Date(file.mtime).toISOString())}`;
        return (
          <li key={file.href} className="dir-index-item">
            <Link href={file.href} className="dir-index-card">
              <span className="dir-index-icon" aria-hidden>
                <FileText />
              </span>
              <span className="dir-index-body">
                <span className="dir-index-row">
                  <span className="dir-index-title">{file.title}</span>
                  <time
                    className="dir-index-date"
                    dateTime={file.date ?? new Date(file.mtime).toISOString()}
                  >
                    {dateLabel}
                  </time>
                </span>
                {file.description ? (
                  <span className="dir-index-desc">{file.description}</span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
