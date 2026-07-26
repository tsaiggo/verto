"use client";

import Link from "next/link";
import { useEffect } from "react";
import ReaderWorkspace from "@/components/reader/ReaderWorkspace";

/**
 * Error boundary for the whole `/read` subtree (documents, directory indexes
 * and tag pages). Rendering inside the reader's `.main` / `.toc-sidebar` grid
 * keeps the navbar, file-tree rail and reading-progress bar intact, so a
 * single failed document doesn't blank the entire app shell.
 */
export default function ReadError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ReaderWorkspace documentLabel="Document error">
      <div className="content-wrap">
        <div className="flex flex-col items-start" style={{ maxWidth: 540, paddingTop: 24 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
            Couldn&apos;t load
          </span>
          <h1
            className="font-semibold"
            style={{ fontSize: 26, marginTop: 10, letterSpacing: "-0.4px", color: "var(--text)" }}
          >
            This document failed to render
          </h1>
          <p style={{ fontSize: 15, marginTop: 10, lineHeight: 1.6, color: "var(--text-muted)" }}>
            The content source may be unreachable or the file could not be parsed. Try again, or
            head back to the library.
          </p>
          <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 28 }}>
            <button
              onClick={reset}
              className="v-btn v-btn--primary v-btn--sm"
              style={{ cursor: "pointer" }}
            >
              Try again
            </button>
            <Link href="/library" className="v-btn v-btn--sm">
              Back to library
            </Link>
          </div>
        </div>
      </div>
    </ReaderWorkspace>
  );
}
