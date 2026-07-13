"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  FolderClosed,
  HardDrive,
  Loader2,
  Plus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import HomeGreeting from "@/components/home/HomeGreeting";
import PageHeader from "@/components/layout/PageHeader";
import ProductUtilities from "@/components/layout/ProductUtilities";
import type { RuntimeLocalIndexState } from "@/components/runtime/useRuntimeLocalIndex";
import { resolveRuntimeSourceHeader } from "@/lib/runtime-source-header";

interface HomePageHeaderProps {
  runtime: RuntimeLocalIndexState;
  bundledDocumentCount: number;
  bundledSectionCount: number;
}

export default function HomePageHeader({
  runtime,
  bundledDocumentCount,
  bundledSectionCount,
}: HomePageHeaderProps) {
  const source = resolveRuntimeSourceHeader(runtime, {
    documents: bundledDocumentCount,
    sections: bundledSectionCount,
  });
  const pending = source.mode === "local-loading";
  const failed = source.mode === "local-error";
  const subtitle =
    source.mode === "bundled"
      ? "Explore the included demo workspace."
      : pending
        ? "Opening your selected local workspace."
        : failed
          ? "Your selected local workspace needs attention."
          : "Here’s what’s happening in your local workspace.";

  return (
    <PageHeader
      variant="entity"
      icon={<Image src="/icon.png" alt="" width={68} height={68} priority />}
      left={<HomeGreeting subtitle={subtitle} />}
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
              <BookOpen aria-hidden />
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
        <div className="home-header-tools">
          <Link href="/editor" className="v-btn v-btn--primary v-btn--sm">
            <Plus aria-hidden /> New
          </Link>
          <Link href="/agent" className="v-btn v-btn--sm">
            <Sparkles aria-hidden /> Ask Agent
          </Link>
          <ProductUtilities />
        </div>
      }
    />
  );
}
