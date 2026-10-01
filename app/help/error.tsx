"use client";

import Link from "next/link";
import { useEffect } from "react";
import ReaderWorkspace from "@/components/reader/ReaderWorkspace";

/**
 * Error boundary for the whole `/help` subtree. Keep the same document frame
 * so a failed Help document leaves the workspace navigation intact.
 */
export default function HelpError({
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
    <ReaderWorkspace documentLabel="Help document error">
      <div className="content-wrap">
        <div className="flex flex-col items-start" style={{ maxWidth: 540, paddingTop: 24 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--verto-muted)" }}>
            Couldn&apos;t load
          </span>
          <h1
            className="font-semibold"
            style={{
              fontSize: 26,
              marginTop: 10,
              letterSpacing: "-0.4px",
              color: "var(--verto-text)",
            }}
          >
            This help page failed to render
          </h1>
          <p
            style={{
              fontSize: 15,
              marginTop: 10,
              lineHeight: 1.6,
              color: "var(--verto-muted)",
            }}
          >
            The page could not be parsed or loaded. Try again, or head back to the Help home.
          </p>
          <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 28 }}>
            <button onClick={reset} className="v-btn v-btn--primary v-btn--sm">
              Try again
            </button>
            <Link href="/help" className="v-btn v-btn--sm">
              Back to Help
            </Link>
          </div>
        </div>
      </div>
    </ReaderWorkspace>
  );
}
