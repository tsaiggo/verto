"use client";

import Link from "next/link";
import { useEffect } from "react";
import CodexRouteState from "@/components/state/CodexRouteState";
import { Button } from "@/components/ui/button";

/** Keeps a failed Help document inside the existing reader workspace. */
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
          <CodexRouteState
            kind="error"
            eyebrow="Couldn’t load"
            title="This help page failed to render"
            description="The page could not be parsed or loaded. Try again, or return to Help."
            actions={
              <>
                <Button
                  type="button"
                  className="codex-route-state__action--primary"
                  onClick={reset}
                >
                  Try again
                </Button>
                <Button asChild variant="outline" className="codex-route-state__action--secondary">
                  <Link href="/help">Back to Help</Link>
                </Button>
              </>
            }
          />
        </div>
      </section>
      <aside className="toc-rail" aria-hidden="true" />
    </>
  );
}
