"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import PrimaryNav from "@/components/layout/PrimaryNav";
import DocumentTabs from "@/components/layout/DocumentTabs";
import VxRail from "@/components/layout/VxRail";
import VxTopBar from "@/components/layout/VxTopBar";
import TitleBar from "@/components/desktop/TitleBar";
import ExternalLinkHandler from "@/components/desktop/ExternalLinkHandler";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { OPEN_NAV_EVENT } from "@/lib/ui/nav-events";
import type { ContentDirNode } from "@/lib/content-source";
import type { SourceInfo } from "@/lib/source-info";
import { resolveShellSurface } from "@/lib/shell-surfaces";

interface AppShellClientProps {
  root: ContentDirNode;
  source: SourceInfo;
  fileCount: number;
  children: React.ReactNode;
}

/**
 * Client orchestration of the application shell.
 *
 * Two shells coexist:
 *  - Document routes (reader / help / runtime) keep the reader-focused shell:
 *    the compact primary nav, the source-prefixed TopBar with the Read/Edit
 *    view segment, and document tabs.
 *  - Every other product surface uses the redesign shell: the persistent 252px
 *    labelled rail (VxRail) plus the universal top bar with the global search
 *    pill (VxTopBar), matching the App Shell Anatomy board.
 */
export default function AppShellClient({ source, children }: AppShellClientProps) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const shellSurface = resolveShellSurface(pathname);

  useEffect(() => {
    const open = () => setNavOpen(true);
    window.addEventListener(OPEN_NAV_EVENT, open);
    return () => window.removeEventListener(OPEN_NAV_EVENT, open);
  }, []);

  // ── Reader / document shell ──────────────────────────────────────────────
  if (shellSurface.documentRoute) {
    return (
      <AuthProvider>
        <ExternalLinkHandler />
        <TitleBar />
        <div className={`app-shell ${shellSurface.shellClassName}`}>
          {/* Desktop primary navigation rail. The reader (/read/*) uses the same
              252px VxRail as the redesign shell for a consistent left nav across
              the app; compact document routes (/help, /runtime) keep the narrow rail. */}
          {shellSurface.showPrimaryRail &&
            (shellSurface.primaryNavVariant === "reader" ? (
              <aside className="vx-rail" aria-label="Primary navigation">
                <VxRail />
              </aside>
            ) : (
              <aside className="app-rail" aria-label="Primary navigation">
                <PrimaryNav />
              </aside>
            ))}

          {/* Mobile navigation */}
          {shellSurface.showMobileNav && (
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetContent
                side="left"
                className={`app-rail-sheet flex flex-col p-0${
                  shellSurface.primaryNavVariant === "reader" ? " vx-rail-sheet" : ""
                }`}
              >
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                {shellSurface.primaryNavVariant === "reader" ? <VxRail /> : <PrimaryNav />}
              </SheetContent>
            </Sheet>
          )}

          <div className="app-region">
            {shellSurface.showTopBar && (
              <>
                <VxTopBar source={source} onMenu={() => setNavOpen(true)} />
                {shellSurface.showDocumentTabs && <DocumentTabs />}
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

  // ── Redesign product shell (home, library, agent, sources, settings, …) ──
  return (
    <AuthProvider>
      <ExternalLinkHandler />
      <TitleBar />
      <div className="vx-shell">
        <aside className="vx-rail" aria-label="Primary navigation">
          <VxRail />
        </aside>

        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent side="left" className="app-rail-sheet vx-rail-sheet flex flex-col p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <VxRail />
          </SheetContent>
        </Sheet>

        <div className="vx-main">
          <VxTopBar onMenu={() => setNavOpen(true)} />
          <main id="main-content" className="vx-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
