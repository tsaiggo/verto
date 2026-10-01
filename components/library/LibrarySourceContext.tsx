"use client";

import Link from "next/link";
import { ArrowUpRight, FolderOpen, Loader2 } from "lucide-react";
import styles from "@/components/library/Library.module.css";
import type { RuntimeLocalDocsState } from "@/components/library/LibraryBrowser";
import { runtimeFolderName } from "@/lib/runtime-source-header";

function sourceDetails(state: RuntimeLocalDocsState, bundledDocumentCount: number) {
  const count = state.status === "idle" ? bundledDocumentCount : state.docs.length;
  switch (state.status) {
    case "idle":
      return {
        copy: `${count} included ${count === 1 ? "document" : "documents"}. Connect a folder to read your own Markdown and MDX files.`,
        action: "Connect a folder",
      };
    case "loading":
      return { copy: "Opening your local folder…", action: "" };
    case "error":
      return {
        copy: "This folder could not be read. Check its permissions or choose it again.",
        action: "Choose another folder",
      };
    case "ready":
      return {
        copy:
          count === 0
            ? "No .md or .mdx files found. Add a file to this folder to get started."
            : `${count} local ${count === 1 ? "file" : "files"}. Your files remain the source of truth.`,
        action: "Manage source",
      };
  }
}

export default function LibrarySourceContext({
  state,
  bundledDocumentCount,
  browserArticleCount = 0,
  showBrowserLibrary = false,
  browserStatus = "ready",
}: {
  state: RuntimeLocalDocsState;
  bundledDocumentCount: number;
  browserArticleCount?: number;
  showBrowserLibrary?: boolean;
  browserStatus?: "loading" | "ready" | "error";
}) {
  const loading = state.status === "loading";
  const error = state.status === "error";
  const title = state.status === "idle" ? "Included demo" : runtimeFolderName(state.folder ?? "");
  const { copy, action } = sourceDetails(state, bundledDocumentCount);

  return (
    <div className={styles.sourceContexts}>
      {showBrowserLibrary ? (
        <section className={styles.sourceContext} aria-label="Browser library source">
          <span className={styles.sourceContextIcon} aria-hidden>
            <FolderOpen />
          </span>
          <div className={styles.sourceContextBody}>
            <h2>Browser library</h2>
            <p>
              {browserStatus === "error"
                ? "Saved browser articles are currently unavailable. Use Retry above to open storage again."
                : browserStatus === "loading"
                  ? "Opening articles saved in this browser…"
                  : `${browserArticleCount} ${browserArticleCount === 1 ? "article" : "articles"} saved on this browser. Export Markdown from the editor to keep a file copy.`}
            </p>
          </div>
          <Link href="/editor" className={styles.sourceContextAction}>
            Write an article
            <ArrowUpRight aria-hidden />
          </Link>
        </section>
      ) : null}
      <section
        className={`${styles.sourceContext}${error ? ` ${styles.sourceContextError}` : ""}`}
        aria-label="Library source"
        aria-busy={loading}
      >
        <span className={styles.sourceContextIcon} aria-hidden>
          {loading ? <Loader2 className={styles.spinner} /> : <FolderOpen />}
        </span>
        <div className={styles.sourceContextBody}>
          <h2 title={state.folder ?? undefined}>{title}</h2>
          <p>{copy}</p>
        </div>
        {!loading ? (
          <Link href="/integrations#local-files" className={styles.sourceContextAction}>
            {action}
            <ArrowUpRight aria-hidden />
          </Link>
        ) : null}
      </section>
    </div>
  );
}
