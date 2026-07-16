import Link from "next/link";
import { FileText } from "lucide-react";
import { ContentPanel, ContentRow } from "@/components/ui/content-primitives";
import type { ContentFileNode } from "@/lib/content-source";
import { recentDocumentDate } from "@/lib/recent-documents";
import styles from "./DocumentList.module.css";

/** Codex-style document rows used by the Recent product surface. */
export default function DocumentList({ files }: { files: ContentFileNode[] }) {
  return (
    <ContentPanel variant="plain">
      <ul className={styles.list} aria-label="Documents">
        {files.map((file) => {
          const updated = recentDocumentDate(file);
          return (
            <li key={file.href} className={styles.item}>
              <Link href={file.href} className={styles.link}>
                <ContentRow
                  className={styles.row}
                  leading={<FileText aria-hidden />}
                  title={file.title}
                  description={file.description}
                  metadata={
                    <time className={styles.time} dateTime={updated.iso ?? undefined}>
                      {updated.label}
                    </time>
                  }
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </ContentPanel>
  );
}
