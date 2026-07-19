"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import DocumentTabs from "@/components/layout/DocumentTabs";
import VxRail from "@/components/layout/VxRail";
import VxTopBar from "@/components/layout/VxTopBar";
import ExternalLinkHandler from "@/components/desktop/ExternalLinkHandler";

import type { ContentDirNode } from "@/lib/content-source";
import type { SourceInfo } from "@/lib/source-info";
import { resolveShellSurface } from "@/lib/shell-surfaces";
import {
  onExclusiveOverlayChange,
  releaseExclusiveOverlay,
  requestExclusiveOverlay,
} from "@/lib/ui/exclusive-overlay";

interface AppShellClientProps {
  root?: ContentDirNode;
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
export default function AppShellClient({ root, source, fileCount, children }: AppShellClientProps) {
  const pathname = usePathname() ?? "/";
  const shellSurface = resolveShellSurface(pathname);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  const openMobileNavigation = () => {
    requestExclusiveOverlay("mobile-navigation");
    setMobileNavigationOpen(true);
  };
  const closeMobileNavigation = () => setMobileNavigationOpen(false);
  const focusMainContent = () => {
    requestAnimationFrame(() => document.getElementById("main-content")?.focus());
  };

  useEffect(
    () =>
      onExclusiveOverlayChange((overlay, open) => {
        if (open && overlay !== "mobile-navigation") setMobileNavigationOpen(false);
      }),
    []
  );

  useEffect(() => {
    if (!mobileNavigationOpen) return;
    return () => releaseExclusiveOverlay("mobile-navigation");
  }, [mobileNavigationOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeAtDesktop = () => {
      if (desktop.matches) setMobileNavigationOpen(false);
    };
    closeAtDesktop();
    desktop.addEventListener("change", closeAtDesktop);
    return () => desktop.removeEventListener("change", closeAtDesktop);
  }, []);

  // Reader / document shell.
  if (shellSurface.documentRoute) {
    return (
      <>
        <ExternalLinkHandler />
        <div className={`vx-shell ${shellSurface.shellClassName}`} data-shell-root>
          <a className="vx-skip-link" href="#main-content" onClick={focusMainContent}>
            Skip to content
          </a>
          {shellSurface.showPrimaryRail && (
            <aside className="vx-rail" aria-label="Primary navigation" data-shell-rail>
              <VxRail source={source} root={root} fileCount={fileCount} />
            </aside>
          )}

          <div className="app-region" data-work-surface>
            {shellSurface.showTopBar && (
              <>
                <SuspendedTopBar source={source} onOpenNavigation={openMobileNavigation} />
                {shellSurface.showDocumentTabs && shellSurface.mode === "compact" && (
                  <DocumentTabs />
                )}
              </>
            )}
            <main id="main-content" className="app-content" tabIndex={-1}>
              {children}
            </main>
          </div>
          <MobileNavigation
            open={mobileNavigationOpen}
            onClose={closeMobileNavigation}
            source={source}
            root={root}
            fileCount={fileCount}
          />
        </div>
      </>
    );
  }

  // Redesign product shell (home, library, agent, sources, settings, ...).
  return (
    <>
      <ExternalLinkHandler />
      <div className="vx-shell" data-shell-root>
        <a className="vx-skip-link" href="#main-content" onClick={focusMainContent}>
          Skip to content
        </a>
        <aside className="vx-rail" aria-label="Primary navigation" data-shell-rail>
          <VxRail source={source} root={root} fileCount={fileCount} />
        </aside>

        <div className="vx-main" data-work-surface>
          {shellSurface.showTopBar && (
            <SuspendedTopBar source={source} onOpenNavigation={openMobileNavigation} />
          )}
          <main id="main-content" className="vx-content" tabIndex={-1}>
            {children}
          </main>
        </div>
        <MobileNavigation
          open={mobileNavigationOpen}
          onClose={closeMobileNavigation}
          source={source}
          root={root}
          fileCount={fileCount}
        />
      </div>
    </>
  );
}

function SuspendedTopBar({
  source,
  onOpenNavigation,
}: {
  source?: SourceInfo;
  onOpenNavigation: () => void;
}) {
  return (
    <Suspense
      fallback={
        <header className="vx-topbar" aria-hidden>
          <span className="vx-topbar-menu" />
        </header>
      }
    >
      <VxTopBar source={source} onOpenNavigation={onOpenNavigation} />
    </Suspense>
  );
}

function MobileNavigation({
  open,
  onClose,
  source,
  root,
  fileCount,
}: {
  open: boolean;
  onClose: () => void;
  source: SourceInfo;
  root?: ContentDirNode;
  fileCount: number;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="vx-mobile-nav-backdrop" />
        <DialogPrimitive.Content
          className="vx-mobile-nav"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            window.requestAnimationFrame(() => {
              const trigger = document.querySelector<HTMLButtonElement>(
                'button[aria-label="Open navigation"]'
              );
              const target =
                trigger && trigger.getClientRects().length > 0
                  ? trigger
                  : document.getElementById("main-content");
              target?.focus({ preventScroll: true });
            });
          }}
        >
          <DialogPrimitive.Title className="sr-only">Primary navigation</DialogPrimitive.Title>
          <div className="vx-mobile-nav-panel">
            <div className="vx-mobile-nav-head">
              <DialogPrimitive.Close asChild>
                <button type="button" className="vx-iconbtn" aria-label="Close navigation">
                  <X aria-hidden />
                </button>
              </DialogPrimitive.Close>
            </div>
            <VxRail onNavigate={onClose} source={source} root={root} fileCount={fileCount} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
