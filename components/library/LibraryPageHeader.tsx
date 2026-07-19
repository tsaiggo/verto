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
import { ContentHeader } from "@/components/layout/ContentPage";
import ProductUtilities from "@/components/layout/ProductUtilities";
import { Button } from "@/components/ui/button";
import type { RuntimeLocalIndexState } from "@/components/runtime/useRuntimeLocalIndex";
import { resolveRuntimeSourceHeader } from "@/lib/runtime-source-header";
import type { SourceInfo } from "@/lib/source-info";

interface LibraryPageHeaderProps {
  runtime: RuntimeLocalIndexState;
  buildSource: SourceInfo;
  bundledDocumentCount: number;
  bundledSectionCount: number;
}

export default function LibraryPageHeader({
  runtime,
  buildSource,
  bundledDocumentCount,
  bundledSectionCount,
}: LibraryPageHeaderProps) {
  const source = resolveRuntimeSourceHeader(runtime, {
    source: buildSource,
    documents: bundledDocumentCount,
    sections: bundledSectionCount,
  });
  const pending = source.mode === "local-loading";
  const failed = source.mode === "local-error";
  const subtitle =
    source.mode === "bundled"
      ? "Explore the included Markdown and MDX documents."
      : source.mode === "build"
        ? `All documents from ${source.sourceLabel}.`
        : pending
          ? "Opening the selected local folder."
          : failed
            ? "The selected local folder could not be read."
            : "All documents in your active local folder.";

  return (
    <ContentHeader
      data-page-identity
      className="library-content-header"
      icon={<LibraryBig />}
      title="Library"
      description={subtitle}
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
      actions={
        <div className="library-header-actions">
          <Button asChild variant="outline" size="sm">
            <Link href="/integrations">
              <FolderInput aria-hidden /> Sources
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/editor">
              <Plus aria-hidden /> New
            </Link>
          </Button>
          <ProductUtilities />
        </div>
      }
    />
  );
}
