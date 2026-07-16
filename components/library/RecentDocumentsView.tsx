"use client";

import Link from "next/link";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentEmptyState, ContentStatus } from "@/components/ui/content-primitives";
import { useRuntimeLocalIndex } from "@/components/runtime/useRuntimeLocalIndex";
import type { ContentFileNode } from "@/lib/content-source";
import { sortRecentDocuments } from "@/lib/recent-documents";
import DocumentList from "./DocumentList";

export default function RecentDocumentsView({
  initialRecent,
}: {
  initialRecent: ContentFileNode[];
}) {
  const runtimeLocal = useRuntimeLocalIndex();

  if (runtimeLocal.status === "loading") {
    return (
      <ContentStatus
        status="loading"
        title="Loading local library"
        description="Recent documents will appear after Verto reads the selected folder."
      />
    );
  }

  if (runtimeLocal.status === "error") {
    return (
      <ContentStatus
        status="error"
        title="Could not read the local library"
        description="Choose another folder or reconnect this source before browsing recent documents."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/integrations">Manage sources</Link>
          </Button>
        }
      />
    );
  }

  const recent =
    runtimeLocal.status === "ready"
      ? sortRecentDocuments(runtimeLocal.index.documents.map((document) => document.node))
      : initialRecent;

  if (recent.length === 0) {
    return (
      <ContentEmptyState
        icon={<Clock3 aria-hidden />}
        title="No recent documents yet"
        description={
          runtimeLocal.status === "ready"
            ? "This local folder has no readable Markdown or MDX documents yet."
            : "Open or update documents in your library and they will appear here for quick access."
        }
      />
    );
  }

  return <DocumentList files={recent} />;
}
