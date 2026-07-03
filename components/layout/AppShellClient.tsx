"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import PrimaryNav from "@/components/layout/PrimaryNav";
import TopBar from "@/components/layout/TopBar";
import DocumentTabs from "@/components/layout/DocumentTabs";
import TitleBar from "@/components/desktop/TitleBar";
import ExternalLinkHandler from "@/components/desktop/ExternalLinkHandler";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { OPEN_NAV_EVENT } from "@/lib/ui/nav-events";
import type { ContentDirNode } from "@/lib/content-source";
import type { SourceInfo } from "@/lib/source-info";

interface AppShellClientProps {
  root: ContentDirNode;
  source: SourceInfo;
  fileCount: number;
  children: React.ReactNode;
}

/** Routes that render the document toolbar + tabs (reader / editor / help). */
function isDocumentRoute(pathname: string): boolean {
  return (
    pathname === "/read" ||
    pathname.startsWith("/read/") ||
    pathname === "/help" ||
    pathname.startsWith("/help/") ||
    pathname.startsWith("/runtime")
  );
}

/**
 * Client orchestration of the application shell: a persistent primary
 * navigation rail on desktop that collapses into a slide-over on mobile. The
 * document toolbar + tabs render only on reader/editor routes; dashboard pages
 * supply their own page header. Contextual rails (sources tree, outline,
 * assistant) are rendered by individual routes.
 */
export default function AppShellClient({ source, children }: AppShellClientProps) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const documentRoute = isDocumentRoute(pathname);

  useEffect(() => {
    const open = () => setNavOpen(true);
    window.addEventListener(OPEN_NAV_EVENT, open);
    return () => window.removeEventListener(OPEN_NAV_EVENT, open);
  }, []);

  return (
    <AuthProvider>
      <ExternalLinkHandler />
      <TitleBar />
      <div className="app-shell">
        {/* Desktop primary navigation rail */}
        <aside className="app-rail" aria-label="Primary navigation">
          <PrimaryNav />
        </aside>

        {/* Mobile navigation */}
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent side="left" className="app-rail-sheet flex flex-col p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <PrimaryNav />
          </SheetContent>
        </Sheet>

        <div className="app-region">
          {documentRoute && (
            <>
              <TopBar source={source} onMenu={() => setNavOpen(true)} />
              <DocumentTabs />
            </>
          )}
          <main id="main-content" className="app-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
