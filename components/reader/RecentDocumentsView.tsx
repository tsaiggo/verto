"use client";

import Link from "next/link";
import { Clock3, Loader2, TriangleAlert } from "lucide-react";
import DocumentList from "@/components/reader/DocumentList";
import { useRuntimeLocalIndex } from "@/components/runtime/useRuntimeLocalIndex";
import type { ContentFileNode } from "@/lib/content-source";
import { sortRecentDocuments } from "@/lib/recent-documents";
import styles from "./DocumentList.module.css";

function EmptyRecent({ message }: { message: string }) {
  return (
    <div className={styles.empty}>
      <span aria-hidden>
        <Clock3 />
      </span>
      <h2>No recent documents yet</h2>
      <p>{message}</p>
      <Link href="/library" className="v-btn v-btn--sm">
        Browse library
      </Link>
    </div>
  );
}

export default function RecentDocumentsView({
  initialRecent,
}: {
  initialRecent: ContentFileNode[];
}) {
  const runtimeLocal = useRuntimeLocalIndex();

  if (runtimeLocal.status === "loading") {
    return (
      <div className={styles.empty} role="status">
        <span aria-hidden>
          <Loader2 className="animate-spin" />
        </span>
        <h2>Loading local library</h2>
        <p>Recent documents will appear after Verto reads the selected folder.</p>
      </div>
    );
  }

  if (runtimeLocal.status === "error") {
    return (
      <div className={styles.empty}>
        <span aria-hidden>
          <TriangleAlert />
        </span>
        <h2>Could not read the local library</h2>
        <p>Choose another folder or reconnect this source before browsing recent documents.</p>
        <Link href="/integrations" className="v-btn v-btn--sm">
          Manage sources
        </Link>
      </div>
    );
  }

  const recent =
    runtimeLocal.status === "ready"
      ? sortRecentDocuments(runtimeLocal.index.documents.map((document) => document.node))
      : initialRecent;

  return recent.length > 0 ? (
    <DocumentList files={recent} />
  ) : (
    <EmptyRecent
      message={
        runtimeLocal.status === "ready"
          ? "This local folder has no readable Markdown or MDX documents yet."
          : "Open or update documents in your library and they will appear here for quick access."
      }
    />
  );
}
