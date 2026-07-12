"use client";

import Link from "next/link";
import { Clock3, Loader2, TriangleAlert } from "lucide-react";
import DocumentList from "@/components/reader/DocumentList";
import { useRuntimeLocalIndex } from "@/components/runtime/useRuntimeLocalIndex";
import type { ContentFileNode } from "@/lib/content-source";
import { sortRecentDocuments } from "@/lib/recent-documents";

function EmptyRecent({ message }: { message: string }) {
  return (
    <div className="v-empty">
      <span className="v-empty-icon" aria-hidden>
        <Clock3 />
      </span>
      <strong className="v-empty-title">No recent documents yet</strong>
      <p className="v-empty-text">{message}</p>
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
      <div className="v-empty" role="status">
        <span className="v-empty-icon" aria-hidden>
          <Loader2 className="animate-spin" />
        </span>
        <strong className="v-empty-title">Loading local library</strong>
        <p className="v-empty-text">
          Recent documents will appear after Verto reads the selected folder.
        </p>
      </div>
    );
  }

  if (runtimeLocal.status === "error") {
    return (
      <div className="v-empty">
        <span className="v-empty-icon" aria-hidden>
          <TriangleAlert />
        </span>
        <strong className="v-empty-title">Could not read the local library</strong>
        <p className="v-empty-text">
          Choose another folder or reconnect this source before browsing recent documents.
        </p>
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
