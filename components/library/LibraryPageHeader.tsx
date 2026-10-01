"use client";

import Link from "next/link";
import { FolderInput, Plus } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import type { RuntimeLocalIndexState } from "@/components/runtime/useRuntimeLocalIndex";
import { Button } from "@/components/ui/button";
import styles from "@/components/library/Library.module.css";
import { resolveRuntimeSourceHeader } from "@/lib/runtime-source-header";

interface LibraryPageHeaderProps {
  runtime: RuntimeLocalIndexState;
  bundledDocumentCount: number;
  bundledSectionCount: number;
  view: "all" | "notes" | "drafts" | "archives";
  browserArticleCount?: number;
}

export default function LibraryPageHeader({
  runtime,
  bundledDocumentCount,
  bundledSectionCount,
  view,
  browserArticleCount = 0,
}: LibraryPageHeaderProps) {
  const source = resolveRuntimeSourceHeader(runtime, {
    documents: bundledDocumentCount,
    sections: bundledSectionCount,
  });
  const pending = source.mode === "local-loading";
  const failed = source.mode === "local-error";
  const subtitle =
    source.mode === "bundled"
      ? view === "notes"
        ? "Your saved articles and Markdown notes."
        : browserArticleCount > 0
          ? "Your browser articles and included workspace documents."
          : "Write articles or explore the included workspace documents."
      : pending
        ? "Opening the selected local folder."
        : failed
          ? "The selected local folder could not be read."
          : view === "notes"
            ? "Markdown notes from your active local folder."
            : "All documents in your active local folder.";

  return (
    <PageHeader
      title={view === "notes" ? "Notes" : "Library"}
      subtitle={subtitle}
      frame="wide"
      tools={
        <>
          <Button asChild size="sm" className={styles.newNoteButton}>
            <Link href="/editor">
              <Plus aria-hidden />
              {view === "notes" ? "New note" : "New article"}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className={styles.sourceButton}>
            <Link href="/integrations" aria-label="Sources">
              <FolderInput aria-hidden />
              <span>Sources</span>
            </Link>
          </Button>
        </>
      }
    />
  );
}
