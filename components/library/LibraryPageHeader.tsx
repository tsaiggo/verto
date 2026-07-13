"use client";

import Link from "next/link";
import {
  FileText,
  FolderClosed,
  FolderInput,
  HardDrive,
  LibraryBig,
  Loader2,
  Plus,
  TriangleAlert,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import ProductUtilities from "@/components/layout/ProductUtilities";
import type { RuntimeLocalIndexState } from "@/components/runtime/useRuntimeLocalIndex";
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
    <PageHeader
      variant="entity"
      icon={<LibraryBig />}
      title="Library"
      subtitle={subtitle}
      meta={
        <>
          <span className="pgh-meta-item" title={source.sourceTitle}>
            <HardDrive aria-hidden /> {source.sourceLabel}
          </span>
          <span className="pgh-meta-item">
            {pending ? (
              <Loader2 aria-hidden />
            ) : failed ? (
              <TriangleAlert aria-hidden />
            ) : (
              <FileText aria-hidden />
            )}
            {source.documentLabel}
          </span>
          <span className="pgh-meta-item">
            {failed ? <TriangleAlert aria-hidden /> : <FolderClosed aria-hidden />}
            {source.sectionLabel}
          </span>
        </>
      }
      tools={
        <div className="pgh-action-group">
          <Link href="/integrations" className="v-btn v-btn--sm">
            <FolderInput aria-hidden /> Sources
          </Link>
          <Link href="/editor" className="v-btn v-btn--primary v-btn--sm">
            <Plus aria-hidden /> New
          </Link>
          <ProductUtilities />
        </div>
      }
    />
  );
}
