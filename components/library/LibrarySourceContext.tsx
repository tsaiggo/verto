"use client";

import Link from "next/link";
import { ArrowUpRight, FolderOpen } from "lucide-react";
import styles from "@/components/library/Library.module.css";
import type { RuntimeLocalDocsState } from "@/components/library/LibraryBrowser";
import { Button } from "@/components/ui/button";

function documentCountLabel(count: number): string {
  return `${count} included ${count === 1 ? "document" : "documents"}`;
}

/**
 * Identifies whether Library is showing bundled examples or the user's active
 * local folder. This stays adjacent to the list so source ownership is visible
 * without turning every document row into source-management UI.
 */
export default function LibrarySourceContext({
  state,
  bundledDocumentCount,
}: {
  state: RuntimeLocalDocsState;
  bundledDocumentCount: number;
}) {
  const canManage = state.status === "idle" || state.status === "error" || state.status === "ready";
  const isEmptyLocal = state.status === "ready" && state.docs.length === 0;
  const actionLabel =
    state.status === "idle"
      ? "Connect a folder"
      : state.status === "error"
        ? "Choose another folder"
        : "Manage source";

  let eyebrow = "Included demo";
  let title = "Verto demo workspace";
  let copy = `You are viewing ${documentCountLabel(bundledDocumentCount)}. Connect a local folder to browse your own Markdown and MDX files.`;

  if (state.status === "loading") {
    eyebrow = "Local library";
    title = "Opening your folder";
    copy = `Reading ${state.folder}…`;
  } else if (state.status === "error") {
    eyebrow = "Local library";
    title = "Your folder needs attention";
    copy = `Verto could not read ${state.folder}. Check the folder and choose it again to continue browsing.`;
  } else if (state.status === "ready") {
    eyebrow = "Local library";
    title = isEmptyLocal ? "No Markdown files found" : "Your local library is connected";
    copy = isEmptyLocal
      ? `${state.folder} has no .md or .mdx files yet. Add one, then return here to browse it.`
      : `Reading ${state.folder} · ${state.docs.length} real local ${state.docs.length === 1 ? "file is" : "files are"} ready to browse.`;
  }

  return (
    <section
      className={`${styles.sourceContext}${
        state.status === "error" ? ` ${styles.sourceContextError}` : ""
      }`}
      aria-label="Library source"
      aria-busy={state.status === "loading"}
    >
      <div className={styles.sourceContextHeader}>
        <span className={styles.sourceContextIcon} aria-hidden>
          <FolderOpen />
        </span>
        <div className={styles.sourceContextLabel}>
          <p>{eyebrow}</p>
          <strong>{title}</strong>
        </div>
      </div>
      <p className={styles.sourceContextCopy}>{copy}</p>
      {canManage ? (
        <Button
          asChild
          variant="outline"
          size="sm"
          className={`${styles.stateAction} ${styles.sourceContextAction}`}
        >
          <Link href="/integrations#local-files">
            {actionLabel}
            <ArrowUpRight aria-hidden />
          </Link>
        </Button>
      ) : null}
    </section>
  );
}
