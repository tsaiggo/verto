"use client";

import Link from "next/link";
import { useEffect } from "react";
import CodexRouteState from "@/components/state/CodexRouteState";
import { Button } from "@/components/ui/button";

export default function AppError({
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
    <div className="codex-state-page">
      <CodexRouteState
        align="center"
        kind="error"
        eyebrow="Couldn’t load"
        title="Something went wrong"
        description="An unexpected error stopped this workspace from loading. Try again, or return home."
        actions={
          <>
            <Button type="button" className="codex-route-state__action--primary" onClick={reset}>
              Try again
            </Button>
            <Button asChild variant="outline" className="codex-route-state__action--secondary">
              <Link href="/">Home</Link>
            </Button>
          </>
        }
      />
    </div>
  );
}
