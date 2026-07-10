"use client";

import { usePathname } from "next/navigation";
import PrimaryNav from "@/components/layout/PrimaryNav";
import DocumentTabs from "@/components/layout/DocumentTabs";
import VxRail from "@/components/layout/VxRail";
import VxTopBar from "@/components/layout/VxTopBar";
import TitleBar from "@/components/desktop/TitleBar";
import ExternalLinkHandler from "@/components/desktop/ExternalLinkHandler";

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
 * Verto is desktop-first in this early phase: the primary rail remains present,
 * and the app intentionally avoids maintaining a second mobile drawer shell.
 */
export default function AppShellClient({ source, children }: AppShellClientProps) {
  const pathname = usePathname() ?? "/";
  const shellSurface = resolveShellSurface(pathname);

  // Reader / document shell.
  if (shellSurface.documentRoute) {
    return (
      <>
        <ExternalLinkHandler />
        <TitleBar />
        <div className={`app-shell ${shellSurface.shellClassName}`}>
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

          <div className="app-region">
            {shellSurface.showTopBar && (
              <>
                <VxTopBar source={source} />
                {shellSurface.showDocumentTabs && <DocumentTabs />}
              </>
            )}
            <main id="main-content" className="app-content" tabIndex={-1}>
              {children}
            </main>
          </div>
        </div>
      </>
    );
  }

  // Redesign product shell (home, library, agent, sources, settings, ...).
  return (
    <>
      <ExternalLinkHandler />
      <TitleBar />
      <div className="vx-shell">
        <aside className="vx-rail" aria-label="Primary navigation">
          <VxRail />
        </aside>

        <div className="vx-main">
          <VxTopBar />
          <main id="main-content" className="vx-content" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
