"use client";

import Link from "next/link";
import {
  FileText,
  FolderClosed,
  FolderInput,
  LibraryBig,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import ProductUtilities from "@/components/layout/ProductUtilities";
import type { RuntimeLocalIndexState } from "@/components/runtime/useRuntimeLocalIndex";
import { Button } from "@/components/ui/button";
import styles from "@/components/library/Library.module.css";
import { resolveRuntimeSourceHeader } from "@/lib/runtime-source-header";

interface LibraryPageHeaderProps {
  runtime: RuntimeLocalIndexState;
  bundledDocumentCount: number;
  bundledSectionCount: number;
}

export default function LibraryPageHeader({
  runtime,
  bundledDocumentCount,
  bundledSectionCount,
}: LibraryPageHeaderProps) {
  const source = resolveRuntimeSourceHeader(runtime, {
    documents: bundledDocumentCount,
    sections: bundledSectionCount,
  });
  const pending = source.mode === "local-loading";
  const failed = source.mode === "local-error";
  const subtitle =
    source.mode === "bundled"
      ? "Explore the included Markdown and MDX documents."
      : pending
        ? "Opening the selected local folder."
        : failed
          ? "The selected local folder could not be read."
          : "All documents in your active local folder.";

  return (
    <header className={styles.header} data-page-identity>
      <div className={styles.headerCopy}>
        <div className={styles.titleRow}>
          <LibraryBig className={styles.titleIcon} aria-hidden />
          <h1 className={styles.title}>Library</h1>
        </div>
        <p className={styles.subtitle}>{subtitle}</p>
        <div className={styles.meta} aria-label="Library summary">
          <span className={styles.metaItem}>
            {pending ? (
              <Loader2 className={styles.spinner} aria-hidden />
            ) : failed ? (
              <TriangleAlert aria-hidden />
            ) : (
              <FileText aria-hidden />
            )}
            {source.documentLabel}
          </span>
          <span className={styles.metaItem}>
            {failed ? <TriangleAlert aria-hidden /> : <FolderClosed aria-hidden />}
            {source.sectionLabel}
          </span>
        </div>
      </div>

      <div className={styles.headerActions}>
        <Button asChild variant="outline" size="sm" className={styles.sourceButton}>
          <Link href="/integrations" aria-label="Sources">
            <FolderInput aria-hidden />
            <span>Sources</span>
          </Link>
        </Button>
        <ProductUtilities />
      </div>
    </header>
  );
}
