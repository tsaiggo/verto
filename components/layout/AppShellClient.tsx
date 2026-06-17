"use client";

import { useState } from "react";
import RailContent from "@/components/layout/RailContent";
import TopBar from "@/components/layout/TopBar";
import TitleBar from "@/components/desktop/TitleBar";
import ExternalLinkHandler from "@/components/desktop/ExternalLinkHandler";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { AuthProvider } from "@/components/auth/AuthProvider";
import type { ContentDirNode } from "@/lib/content-source";
import type { SourceInfo } from "@/lib/source-info";

interface AppShellClientProps {
  root: ContentDirNode;
  source: SourceInfo;
  fileCount: number;
  footer: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Client orchestration of the application shell: a fixed left rail on desktop
 * that collapses into a slide-over on mobile, a sticky top bar, the scrolling
 * content region, and the footer.
 */
export default function AppShellClient({
  root,
  source,
  fileCount,
  footer,
  children,
}: AppShellClientProps) {
  const [navOpen, setNavOpen] = useState(false);

  const rail = <RailContent root={root} source={source} fileCount={fileCount} />;

  return (
    <AuthProvider>
      <ExternalLinkHandler />
      <TitleBar />
      <div className="app-shell">
        {/* Desktop rail */}
        <aside className="app-rail" aria-label="Sidebar">
          {rail}
        </aside>

        {/* Mobile rail */}
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent side="left" className="app-rail-sheet flex flex-col p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            {rail}
          </SheetContent>
        </Sheet>

        <div className="app-region">
          <TopBar source={source} onMenu={() => setNavOpen(true)} />
          <main id="main-content" className="app-content" tabIndex={-1}>
            {children}
          </main>
          {footer}
        </div>
      </div>
    </AuthProvider>
  );
}
