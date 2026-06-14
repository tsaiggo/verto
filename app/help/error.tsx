"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Error boundary for the whole `/help` subtree. Rendering inside the reader's
 * `.main` / `.toc-sidebar` grid keeps the navbar, rail and reading-progress bar
 * intact, so a single failed Help document doesn't blank the entire app shell.
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
    <>
      <section className="main" aria-label="Document error">
        <div className="content-wrap">
          <div className="flex flex-col items-start" style={{ maxWidth: 540, paddingTop: 24 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.6px",
                color: "var(--text-light)",
              }}
            >
              Couldn&apos;t load
            </span>
            <h1
              className="font-semibold"
              style={{ fontSize: 26, marginTop: 10, letterSpacing: "-0.4px", color: "var(--text)" }}
            >
              This help page failed to render
            </h1>
            <p style={{ fontSize: 15, marginTop: 10, lineHeight: 1.6, color: "var(--text-muted)" }}>
              The page could not be parsed or loaded. Try again, or head back to the Help home.
            </p>
            <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 28 }}>
              <button
                onClick={reset}
                className="inline-flex items-center justify-center font-medium text-white transition-opacity duration-150 hover:opacity-90"
                style={{
                  background: "var(--accent-blue)",
                  padding: "9px 24px",
                  borderRadius: "var(--radius)",
                  fontSize: 14,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <Link
                href="/help"
                className="inline-flex items-center justify-center font-medium no-underline transition-colors duration-150 hover:bg-bg-muted"
                style={{
                  border: "1px solid var(--border)",
                  padding: "9px 24px",
                  borderRadius: "var(--radius)",
                  fontSize: 14,
                  color: "var(--text)",
                }}
              >
                Back to Help
              </Link>
            </div>
          </div>
        </div>
      </section>
      <aside className="toc-sidebar" />
    </>
  );
}
