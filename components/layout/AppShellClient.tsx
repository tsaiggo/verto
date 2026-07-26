"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import DocumentTabs from "@/components/layout/DocumentTabs";
import VxRail from "@/components/layout/VxRail";
import VxTopBar from "@/components/layout/VxTopBar";
import TitleBar from "@/components/desktop/TitleBar";
import ExternalLinkHandler from "@/components/desktop/ExternalLinkHandler";
import frameStyles from "@/components/workspace/LocalVaultFrame.module.css";
import styles from "@/components/layout/VertoShell.module.css";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { SourceInfo } from "@/lib/source-info";
import { resolveShellSurface } from "@/lib/shell-surfaces";

interface AppShellClientProps {
  source: SourceInfo;
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
  const focusMainContent = () => {
    requestAnimationFrame(() => document.getElementById("main-content")?.focus());
  };

  // The local Library is an app inside the desktop app: its page tree, document
  // tabs and inspector need one uninterrupted canvas rather than the generic
  // product rail plus top bar. Keep the shared native title bar and link
  // handler, but let the local-workspace route own everything below it.
  if (pathname === "/runtime/local") {
    return (
      <>
        <ExternalLinkHandler />
        <TitleBar />
        <a
          className={cn("vx-skip-link", styles.skipLink, styles.runtimeSkipLink)}
          href="#main-content"
          onClick={focusMainContent}
        >
          Skip to document
        </a>
        <main id="main-content" className={frameStyles.frame} tabIndex={-1}>
          {children}
        </main>
      </>
    );
  }

  const documentRoute = shellSurface.documentRoute;
  const workSurfaceClass = documentRoute ? "app-region" : "vx-main";
  const contentClass = documentRoute ? "app-content" : "vx-content";

  return (
    <>
      <ExternalLinkHandler />
      <TitleBar />
      <div
        className={cn(
          "vx-shell",
          shellSurface.shellClassName,
          styles.shell,
          documentRoute && styles.documentShell
        )}
        data-shell-root
      >
        <a
          className={cn("vx-skip-link", styles.skipLink)}
          href="#main-content"
          onClick={focusMainContent}
        >
          Skip to content
        </a>
        {shellSurface.showPrimaryRail ? (
          <aside
            className={cn("vx-rail", styles.rail)}
            aria-label="Primary navigation"
            data-shell-rail
          >
            <VxRail />
          </aside>
        ) : null}

        <div className={cn(workSurfaceClass, styles.workSurface)} data-work-surface>
          {shellSurface.showTopBar ? (
            <>
              <VxTopBar
                source={documentRoute ? source : undefined}
                onOpenNavigation={openMobileNavigation}
              />
              {documentRoute && shellSurface.showDocumentTabs && shellSurface.mode === "compact" ? (
                <DocumentTabs />
              ) : null}
            </>
          ) : null}
          <main id="main-content" className={cn(contentClass, styles.content)} tabIndex={-1}>
            {children}
          </main>
        </div>
        <MobileNavigation open={mobileNavigationOpen} onClose={closeMobileNavigation} />
      </div>
    </>
  );
}

function MobileNavigation({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <SheetContent
        side="left"
        className={cn("vx-mobile-nav", styles.mobileNavigation)}
        closeLabel="Close navigation"
        aria-describedby={undefined}
      >
        <SheetTitle className="sr-only">Primary navigation</SheetTitle>
        <VxRail expanded onNavigate={onClose} />
      </SheetContent>
    </Sheet>
  );
}
