"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import PersistentAgent from "@/components/agent/PersistentAgent";
import VxTopBar from "@/components/layout/VxTopBar";
import WorkspaceShell from "@/components/shell/WorkspaceShell";
import { getPanel } from "@/components/shell/panels/registry";
import CommandDialog from "@/components/command/CommandDialog";
import TitleBar from "@/components/desktop/TitleBar";
import ExternalLinkHandler from "@/components/desktop/ExternalLinkHandler";
import frameStyles from "@/components/workspace/LocalVaultFrame.module.css";
import styles from "@/components/layout/VertoShell.module.css";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import type { SourceInfo } from "@/lib/source-info";
import type { AssistantKind } from "@/components/agent/agent-types";
import { resolveShellSurface } from "@/lib/shell-surfaces";
import type { LabsSidebarTree } from "@/lib/sidebar/buildLabsTree";

interface AppShellClientProps {
  source: SourceInfo;
  labsTree: LabsSidebarTree;
  helpTree: LabsSidebarTree;
  assistantKind: AssistantKind;
  assistantModel: string;
  children: React.ReactNode;
}

const AGENT_PANE_OPEN_KEY = "verto:agent-pane:open";

/**
 * Client orchestration of the application shell.
 *
 * The desktop rail becomes an accessible modal drawer on narrow screens so the
 * same information architecture remains available while the reader can use the
 * full viewport width.
 */
export default function AppShellClient({
  source,
  labsTree,
  helpTree,
  assistantKind,
  assistantModel,
  children,
}: AppShellClientProps) {
  const pathname = usePathname() ?? "/";
  const shellSurface = resolveShellSurface(pathname);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(true);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = window.localStorage.getItem("verto:labs-sidebar:collapsed");
      return raw === "1" || raw === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("verto:labs-sidebar:collapsed");
      if (raw === "1" || raw === "true") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted collapsed state from localStorage on mount
        setCollapsed(true);
      } else if (raw === "0" || raw === "false") setCollapsed(false);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(AGENT_PANE_OPEN_KEY);
      if (stored === "0" || stored === "1") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the user's pane preference after hydration
        setAgentOpen(stored === "1");
      }
    } catch {
      // Storage access is optional; an open pane is the default.
    }
  }, []);

  const setAgentOpenPersist = useCallback((open: boolean) => {
    setAgentOpen(open);
    try {
      window.localStorage.setItem(AGENT_PANE_OPEN_KEY, open ? "1" : "0");
    } catch {
      // Keep the in-memory preference when storage is unavailable.
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("verto:labs-sidebar:collapsed", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const openMobileNavigation = () => setMobileNavigationOpen(true);
  const closeMobileNavigation = () => setMobileNavigationOpen(false);
  const focusMainContent = () => {
    requestAnimationFrame(() => document.getElementById("main-content")?.focus());
  };

  const desktopPanel = useMemo(
    () => getPanel(pathname, labsTree, toggleCollapsed, helpTree),
    [pathname, labsTree, toggleCollapsed, helpTree]
  );
  const sheetPanel = useMemo(
    () => getPanel(pathname, labsTree, undefined, helpTree),
    [pathname, labsTree, helpTree]
  );

  // The local Library is an app inside the desktop app: its page tree, document
  // tabs and inspector need one uninterrupted canvas rather than the generic
  // product rail plus top bar. Keep the shared native title bar and link
  // handler, but let the local-workspace route own everything below it.
  // Labs preview is also an isolated canvas: suppress the global command
  // trigger and top-bar shortcuts so only the experiment's own CmdK handling
  // (visibility-gated via getClientRects) is active.
  if (pathname === "/runtime/local" || pathname.startsWith("/labs")) {
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
  const isAgentPage = pathname === "/agent";
  const isReaderRoute = pathname === "/read" || pathname.startsWith("/read/");
  const hasRouteAgent = isReaderRoute || pathname === "/editor" || pathname.startsWith("/editor/");
  const agentVisible = isAgentPage || (!hasRouteAgent && agentOpen);
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
          <WorkspaceShell
            panel={desktopPanel}
            collapsed={collapsed}
            onToggleCollapsed={toggleCollapsed}
          />
        ) : null}

        <div
          className={cn(
            workSurfaceClass,
            styles.workSurface,
            isAgentPage && styles.agentPageSurface
          )}
          data-work-surface
        >
          {shellSurface.showTopBar ? (
            <VxTopBar
              source={documentRoute ? source : undefined}
              onOpenNavigation={openMobileNavigation}
              agentOpen={agentOpen}
              onToggleAgent={
                hasRouteAgent || isAgentPage ? undefined : () => setAgentOpenPersist(!agentOpen)
              }
            />
          ) : null}
          {/* Global command palette — hidden on /runtime/local via early return; trigger gating via getClientRects */}
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 12,
              zIndex: 15,
              display: shellSurface.showTopBar ? "block" : "none",
            }}
          >
            <CommandDialog />
          </div>
          <main
            id={isAgentPage ? undefined : "main-content"}
            className={cn(contentClass, styles.content)}
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
        <div
          id={isAgentPage ? "main-content" : "agent-pane"}
          role={isAgentPage ? "main" : "complementary"}
          aria-label="Agent"
          className={cn(styles.agentPane, isAgentPage && styles.agentPaneExpanded)}
          hidden={!agentVisible}
          inert={!agentVisible}
          tabIndex={isAgentPage ? -1 : undefined}
          data-agent-pane
        >
          <PersistentAgent
            active={agentVisible}
            assistantKind={assistantKind}
            assistantModel={assistantModel}
            variant={isAgentPage ? "page" : "pane"}
            onCollapse={() => setAgentOpenPersist(false)}
          />
        </div>
        <MobileNavigation
          open={mobileNavigationOpen}
          onClose={closeMobileNavigation}
          sheetPanel={sheetPanel}
        />
      </div>
    </>
  );
}

function MobileNavigation({
  open,
  onClose,
  sheetPanel,
}: {
  open: boolean;
  onClose: () => void;
  sheetPanel: React.ReactNode;
}) {
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
        <WorkspaceShell panel={sheetPanel} inSheet />
      </SheetContent>
    </Sheet>
  );
}
