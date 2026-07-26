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
          background: "var(--verto-canvas, #f7f7f5)",
          color: "var(--verto-text, #171715)",
          fontFamily:
            'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          aria-hidden
          style={{
            display: "grid",
            width: 36,
            height: 36,
            placeItems: "center",
            marginBottom: 22,
            border: "1px solid #e3e3df",
            borderRadius: 9,
            background: "#ffffff",
            color: "#42423e",
            fontSize: 17,
            fontWeight: 650,
          }}
        >
          !
        </div>
        <p
          style={{
            margin: "0 0 7px",
            color: "#74746f",
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: "0.045em",
            textTransform: "uppercase",
          }}
        >
          Critical startup error
        </p>
        <h1
          style={{
            margin: 0,
            fontWeight: 650,
            fontSize: "clamp(24px, 5vw, 31px)",
            lineHeight: 1.14,
            letterSpacing: "-0.035em",
            color: "#171715",
          }}
        >
          Verto couldn&apos;t start
        </h1>
        <p
          style={{
            margin: "12px 0 0",
            maxWidth: 420,
            fontSize: 14,
            lineHeight: 1.65,
            color: "#42423e",
          }}
        >
          A critical error stopped the local workspace from loading. Your files were not changed.
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginTop: 28,
          }}
        >
          <button
            onClick={reset}
            style={{
              border: "none",
              cursor: "pointer",
              fontWeight: 500,
              fontSize: 12.5,
              color: "#ffffff",
              background: "#151515",
              minHeight: 36,
              padding: "0 13px",
              borderRadius: 8,
            }}
          >
            Try again
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- hard reload, not client nav, to escape the corrupted root state */}
          <a
            href="/"
            style={{
              fontWeight: 500,
              fontSize: 12.5,
              textDecoration: "none",
              color: "#42423e",
              border: "1px solid #e3e3df",
              minHeight: 36,
              display: "inline-flex",
              alignItems: "center",
              padding: "0 13px",
              borderRadius: 8,
            }}
          >
            Home
          </a>
        </div>
      </body>
    </html>
  );
}
