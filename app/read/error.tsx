"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import DocumentTabs from "@/components/layout/DocumentTabs";
import ReaderFrame from "@/components/reader/ReaderFrame";
import CodexRouteState from "@/components/state/CodexRouteState";
import { Button } from "@/components/ui/button";
import { readerRouteHasDocumentTabs } from "@/lib/reader-route-frame";

/** Keeps a failed document inside the shared ReaderFrame contract. */
export default function ReadError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname() ?? "/read";

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ReaderFrame
      mainLabel="Document error"
      tabs={readerRouteHasDocumentTabs(pathname) ? <DocumentTabs /> : undefined}
    >
      <div className="content-wrap">
        <CodexRouteState
          kind="error"
          eyebrow="Couldn’t load"
          title="This document failed to render"
          description="The content source may be unreachable or the file could not be parsed. Try again, or return to the library."
          actions={
            <>
              <Button type="button" className="codex-route-state__action--primary" onClick={reset}>
                Try again
              </Button>
              <Button asChild variant="outline" className="codex-route-state__action--secondary">
                <Link href="/read">Back to library</Link>
              </Button>
            </>
          }
        />
      </div>
    </ReaderFrame>
  );
}
