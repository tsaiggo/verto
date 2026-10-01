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
}

export default function LibraryPageHeader({
  runtime,
  bundledDocumentCount,
  bundledSectionCount,
  view,
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
      tools={
        view === "notes" ? (
          <Button asChild size="sm" className={styles.newNoteButton}>
            <Link href="/editor">
              <Plus aria-hidden />
              New note
            </Link>
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm" className={styles.sourceButton}>
            <Link href="/integrations" aria-label="Sources">
              <FolderInput aria-hidden />
              <span>Sources</span>
            </Link>
          </Button>
        )
      }
    />
  );
}
