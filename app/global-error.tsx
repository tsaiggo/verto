"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for crashes thrown by the root layout itself. Next.js
 * renders this *instead of* `app/layout.tsx`, so it must ship its own
 * `<html>` / `<body>` and cannot rely on the app shell, providers, or the
 * theme script. Styling is inlined with literal fallbacks so the screen still
 * reads correctly even when the global stylesheet failed to load.
 */
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "40px 20px",
          background: "var(--bg, #ffffff)",
          color: "var(--text, #111827)",
          fontFamily: 'var(--font-mono, "SF Mono", "Fira Code", Consolas, monospace)',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontWeight: 700,
            fontSize: "clamp(72px, 12vw, 120px)",
            lineHeight: 1,
            letterSpacing: "-2px",
            color: "var(--text-light, #9ca3af)",
          }}
        >
          Error
        </h1>
        <h2
          style={{
            margin: "16px 0 0",
            fontWeight: 600,
            fontSize: 22,
            letterSpacing: "-0.3px",
            color: "var(--text, #111827)",
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            margin: "8px 0 0",
            maxWidth: 420,
            fontSize: 16,
            lineHeight: 1.6,
            color: "var(--text-muted, #6b7280)",
          }}
        >
          A critical error stopped the app from loading. Try again, or return to the home page.
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginTop: 40,
          }}
        >
          <button
            onClick={reset}
            style={{
              border: "none",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: 15,
              color: "#ffffff",
              background: "var(--accent-blue, #2563eb)",
              padding: "10px 28px",
              borderRadius: "var(--radius, 8px)",
            }}
          >
            Try again
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- hard reload, not client nav, to escape the corrupted root state */}
          <a
            href="/"
            style={{
              fontWeight: 500,
              fontSize: 15,
              textDecoration: "none",
              color: "var(--text, #111827)",
              border: "1px solid var(--border, #e5e7eb)",
              padding: "10px 28px",
              borderRadius: "var(--radius, 8px)",
            }}
          >
            Home
          </a>
        </div>
      </body>
    </html>
  );
}
