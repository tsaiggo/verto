"use client";

import { useEffect } from "react";
import CodexRouteState, {
  CODEX_ROUTE_STATE_STANDALONE_CSS,
} from "@/components/state/CodexRouteState";
import { Button } from "@/components/ui/button";

/**
 * Last-resort boundary for crashes thrown by the root layout itself. Next.js
 * renders this instead of app/layout.tsx, so critical light and dark fallback
 * styles live in the document head before the body can paint.
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
      <head>
        <style data-codex-state-fallback>{CODEX_ROUTE_STATE_STANDALONE_CSS}</style>
      </head>
      <body
        style={{
          boxSizing: "border-box",
          minHeight: "100dvh",
          margin: 0,
          display: "grid",
          placeItems: "center",
          padding: "32px",
          colorScheme: "light dark",
          background: "var(--codex-surface, Canvas)",
          color: "var(--codex-text, CanvasText)",
          fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <CodexRouteState
          align="center"
          kind="error"
          eyebrow="Verto couldn’t start"
          title="Something went wrong"
          description="A critical error stopped the app from loading. Try again, or return home."
          actions={
            <>
              <Button type="button" className="codex-route-state__action--primary" onClick={reset}>
                Try again
              </Button>
              <Button asChild variant="outline" className="codex-route-state__action--secondary">
                {/* A hard reload escapes a corrupted root layout state. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/">Home</a>
              </Button>
            </>
          }
        />
      </body>
    </html>
  );
}
