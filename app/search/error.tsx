"use client";

import Link from "next/link";
import { useEffect } from "react";
import CodexRouteState from "@/components/state/CodexRouteState";
import { Button } from "@/components/ui/button";

/** Keeps an unavailable library index scoped to the Search workspace. */
export default function SearchError({
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
    <div className="search-page">
      <div className="search-main">
        <CodexRouteState
          kind="error"
          eyebrow="Search unavailable"
          title="The library index couldn’t be loaded"
          description="The connected source may be offline or misconfigured. Try again, or review the source connection."
          actions={
            <>
              <Button type="button" className="codex-route-state__action--primary" onClick={reset}>
                Try again
              </Button>
              <Button asChild variant="outline" className="codex-route-state__action--secondary">
                <Link href="/integrations">Review sources</Link>
              </Button>
            </>
          }
        />
      </div>
    </div>
  );
}
