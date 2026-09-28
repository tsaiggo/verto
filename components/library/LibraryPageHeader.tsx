"use client";

import Link from "next/link";
import { FileText, FolderClosed, FolderInput, Loader2, TriangleAlert } from "lucide-react";
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
  noteCount: number;
}

export default function LibraryPageHeader({
  runtime,
  bundledDocumentCount,
  bundledSectionCount,
  view,
  noteCount,
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
        ? "Markdown notes from the included workspace."
        : "Explore the included Markdown and MDX documents."
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
      meta={
        <div className={styles.meta} aria-label="Library summary">
          <span className={styles.metaItem}>
            {pending ? (
              <Loader2 className={styles.spinner} aria-hidden />
            ) : failed ? (
              <TriangleAlert aria-hidden />
            ) : (
              <FileText aria-hidden />
            )}
            {view === "notes" && !pending && !failed
              ? `${noteCount} ${noteCount === 1 ? "note" : "notes"}`
              : source.documentLabel}
          </span>
          <span className={styles.metaItem}>
            {failed ? <TriangleAlert aria-hidden /> : <FolderClosed aria-hidden />}
            {source.sectionLabel}
          </span>
        </div>
      }
      tools={
        <Button asChild variant="outline" size="sm" className={styles.sourceButton}>
          <Link href="/integrations" aria-label="Sources">
            <FolderInput aria-hidden />
            <span>Sources</span>
          </Link>
        </Button>
      }
    />
  );
}
