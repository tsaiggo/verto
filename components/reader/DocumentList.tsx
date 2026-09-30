import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import type { ContentFileNode } from "@/lib/content-source";
import { formatDate } from "@/lib/format";
import styles from "./DocumentList.module.css";

/**
 * Shared editorial list for "a set of documents to open" surfaces (the tag and
 * status filter pages). Renders each file as a `.dir-index` borderless row, the
 * same document-row language the directory index uses, so every
 * list-of-documents view in the app reads consistently: a bare glyph, a title,
 * a one-line description, a right-aligned date, and a chevron that slides in on
 * hover. Every result here is a file, so all rows carry the FileText glyph.
 *
 * Replaces the raw inline-styled `<ul>` the tag/status pages used to inline;
 * that markup lived inside `.prose`, so it also inherited the prose list dot.
 * The `.dir-index` classes reset the list styling, removing that stray bullet.
 */
export default function DocumentList({ files }: { files: ContentFileNode[] }) {
  return (
    <ul className={`dir-index ${styles.list}`} aria-label="Documents">
      {files.map((file) => {
        const dateISO = file.date ?? new Date(file.mtime).toISOString();
        const dateLabel = file.date
          ? formatDate(file.date)
          : `Updated ${formatDate(new Date(file.mtime).toISOString())}`;
        return (
          <li key={file.href} className={styles.item}>
            <Link href={file.href} className={styles.row}>
              <span className={styles.icon} aria-hidden>
                <FileText />
              </span>
              <span className={styles.copy}>
                <span className={styles.title}>{file.title}</span>
                {file.description ? (
                  <span className={styles.description}>{file.description}</span>
                ) : null}
              </span>
              <span className={styles.meta}>
                <time dateTime={dateISO}>{dateLabel}</time>
                <ChevronRight aria-hidden />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
