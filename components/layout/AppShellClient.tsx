"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
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
 * The desktop rail becomes an accessible modal drawer on narrow screens so the
 * same information architecture remains available while the reader can use the
 * full viewport width.
 */
export default function AppShellClient({ source, children }: AppShellClientProps) {
  const pathname = usePathname() ?? "/";
  const shellSurface = resolveShellSurface(pathname);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  const openMobileNavigation = () => setMobileNavigationOpen(true);
  const closeMobileNavigation = () => setMobileNavigationOpen(false);

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
                <VxTopBar source={source} onOpenNavigation={openMobileNavigation} />
                {shellSurface.showDocumentTabs && <DocumentTabs />}
              </>
            )}
            <main id="main-content" className="app-content" tabIndex={-1}>
              {children}
            </main>
          </div>
          <MobileNavigation open={mobileNavigationOpen} onClose={closeMobileNavigation} />
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
          <VxTopBar onOpenNavigation={openMobileNavigation} />
          <main id="main-content" className="vx-content" tabIndex={-1}>
            {children}
          </main>
        </div>
        <MobileNavigation open={mobileNavigationOpen} onClose={closeMobileNavigation} />
      </div>
    </>
  );
}

function MobileNavigation({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="vx-mobile-nav"
      aria-label="Primary navigation"
      onCancel={onClose}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="vx-mobile-nav-panel">
        <div className="vx-mobile-nav-head">
          <button
            type="button"
            className="vx-iconbtn"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <X aria-hidden />
          </button>
        </div>
        <VxRail onNavigate={onClose} />
      </div>
    </dialog>
  );
}
