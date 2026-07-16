import Link from "next/link";
import CodexRouteState from "@/components/state/CodexRouteState";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="codex-state-page">
      <CodexRouteState
        align="center"
        kind="not-found"
        title="Page not found"
        description="The page you’re looking for doesn’t exist or has moved."
        actions={
          <>
            <Button asChild className="codex-route-state__action--primary">
              <Link href="/">Home</Link>
            </Button>
            <Button asChild variant="outline" className="codex-route-state__action--secondary">
              <Link href="/read">Browse Library</Link>
            </Button>
          </>
        }
      />
    </div>
  );
}
