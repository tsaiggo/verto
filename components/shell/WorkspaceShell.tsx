"use client";

/**
 * WorkspaceShell — one primary sidebar with expanded and compact states.
 * UnifiedSidebarPanel keeps product navigation and route context together;
 * the icon rail replaces it when collapsed.
 * Tokens: cold v2 only (Inter/system, #e9eaee borders, #6B6B67 muted, #2563EB focus, #D97706 warning if surfaced)
 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import MailViewLink from "@/components/mail/MailViewLink";
import { usePathname, useSearchParams } from "next/navigation";
import { Folder, Home, Inbox, Layers, NotebookPen, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getInboxAttentionCount, loadInbox, subscribeInbox } from "@/lib/inbox";
import UnifiedSidebarPanel from "./UnifiedSidebarPanel";
import SidebarProfileMenu from "./SidebarProfileMenu";
import styles from "./WorkspaceShell.module.css";

export const WORKSPACE_SHELL_COLLAPSED_KEY = "verto:labs-sidebar:collapsed";

const PRIMARY_ROUTE_GROUPS: Record<string, readonly string[]> = {
  "/": ["/", "/recent"],
  "/library": ["/library", "/read", "/editor", "/collections", "/bookmarks", "/tags"],
  "/inbox": ["/inbox", "/mail"],
};

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

function InboxRailLink({
  href,
  active,
  attentionCount,
}: {
  href: string;
  active: boolean;
  attentionCount: number;
}) {
  const NavigationLink = matchesRoute(href.split("?")[0], "/mail") ? MailViewLink : Link;
  return (
    <NavigationLink
      href={href}
      className={cn(styles.iconButton, active && styles.active)}
      aria-label="Inbox"
      title="Inbox"
      aria-current={active ? "page" : undefined}
      data-testid="ws-rail-inbox"
    >
      <Inbox aria-hidden="true" />
      {attentionCount > 0 && (
        <span className={styles.railBadge} aria-label={`${attentionCount} items need attention`}>
          {attentionCount > 99 ? "99+" : attentionCount}
        </span>
      )}
    </NavigationLink>
  );
}

function MailInboxRailLink({
  pathname,
  attentionCount,
}: {
  pathname: string;
  attentionCount: number;
}) {
  const query = useSearchParams()?.toString();
  return (
    <InboxRailLink
      href={`${pathname}${query ? `?${query}` : ""}`}
      active
      attentionCount={attentionCount}
    />
  );
}

function readCollapsedFromStorage(fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_SHELL_COLLAPSED_KEY);
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
  } catch {
    // ignore
  }
  return fallback;
}

function writeCollapsedToStorage(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKSPACE_SHELL_COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}

export interface WorkspaceShellProps {
  panel: React.ReactNode;
  defaultCollapsed?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  inSheet?: boolean;
  className?: string;
}

// eslint-disable-next-line complexity, max-lines-per-function -- workspace shell composes compact/expanded navigation, shared utilities and collapse persistence
export default function WorkspaceShell({
  panel,
  defaultCollapsed = false,
  collapsed: controlledCollapsed,
  onToggleCollapsed,
  inSheet = false,
  className,
}: WorkspaceShellProps) {
  const pathname = usePathname() ?? "/";
  const brandRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const restoreToggleFocus = useRef(false);
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const [inboxAttentionCount, setInboxAttentionCount] = useState(0);

  useEffect(() => {
    const refreshInboxCount = () =>
      setInboxAttentionCount(getInboxAttentionCount(loadInbox().items));
    refreshInboxCount();
    return subscribeInbox(refreshInboxCount);
  }, []);

  const isControlled = controlledCollapsed !== undefined && !inSheet;
  useEffect(() => {
    if (isControlled || inSheet) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the client-only preference after hydration
    setInternalCollapsed(readCollapsedFromStorage(defaultCollapsed));
  }, [defaultCollapsed, inSheet, isControlled]);
  const collapsed = isControlled
    ? (controlledCollapsed as boolean)
    : inSheet
      ? false
      : internalCollapsed;

  const toggleCollapsed = useCallback(() => {
    if (inSheet) return;
    restoreToggleFocus.current = rootRef.current?.contains(document.activeElement) ?? false;
    if (isControlled && onToggleCollapsed) {
      onToggleCollapsed();
      return;
    }
    setInternalCollapsed((prev) => {
      const next = !prev;
      writeCollapsedToStorage(next);
      return next;
    });
  }, [inSheet, isControlled, onToggleCollapsed]);

  const isActive = useCallback(
    (href: string): boolean => {
      const routes = PRIMARY_ROUTE_GROUPS[href] ?? [href];
      return routes.some((route) => matchesRoute(pathname, route));
    },
    [pathname]
  );

  const openGlobalCommand = useCallback(() => {
    const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
    if (trigger) {
      trigger.click();
      return;
    }
    // Fallback: dispatch CmdK if trigger not found (should not happen as global trigger always mounted except /labs & /runtime/local)
    const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
    window.dispatchEvent(ev);
  }, []);

  const effectiveCollapsed = inSheet ? false : collapsed;

  useEffect(() => {
    if (!restoreToggleFocus.current) return;
    restoreToggleFocus.current = false;
    if (effectiveCollapsed) brandRef.current?.focus();
    else panelRef.current?.querySelector<HTMLButtonElement>("[data-sidebar-toggle]")?.focus();
  }, [effectiveCollapsed]);

  // Hydrate-safe: before mount, avoid flash by using SSR fallback (expanded). After mount, apply stored value.
  const asideCollapsedClass = effectiveCollapsed ? styles.isCollapsed : "";

  return (
    <aside
      ref={rootRef}
      className={cn(styles.root, asideCollapsedClass, inSheet && styles.inSheet, className)}
      aria-label="Main navigation"
      data-shell-rail
      data-collapsed={effectiveCollapsed ? "true" : "false"}
      data-testid={inSheet ? "workspace-shell-sheet" : "workspace-shell"}
    >
      <nav className={styles.rail} aria-label="App navigation" hidden={!effectiveCollapsed}>
        <button
          ref={brandRef}
          type="button"
          className={styles.brand}
          aria-label={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!effectiveCollapsed}
          onClick={toggleCollapsed}
          data-testid="workspace-shell-brand"
        >
          <Layers aria-hidden="true" />
        </button>

        <div className={styles.railLinks}>
          {/* Home -> / */}
          <Link
            href="/"
            className={cn(styles.iconButton, isActive("/") && styles.active)}
            aria-label="Home"
            title="Home"
            aria-current={isActive("/") ? "page" : undefined}
            data-testid="ws-rail-home"
          >
            <Home aria-hidden="true" />
          </Link>

          {/* Library includes browsing and editing documents. */}
          <Link
            href="/library"
            className={cn(styles.iconButton, isActive("/library") && styles.active)}
            aria-label="Library"
            title="Library"
            aria-current={isActive("/library") ? "page" : undefined}
            data-testid="ws-rail-library"
          >
            <Folder aria-hidden="true" />
          </Link>

          {matchesRoute(pathname, "/mail") ? (
            <Suspense
              fallback={
                <InboxRailLink href={pathname} active attentionCount={inboxAttentionCount} />
              }
            >
              <MailInboxRailLink pathname={pathname} attentionCount={inboxAttentionCount} />
            </Suspense>
          ) : (
            <InboxRailLink
              href="/inbox"
              active={isActive("/inbox")}
              attentionCount={inboxAttentionCount}
            />
          )}

          <Link
            href="/studio"
            className={cn(styles.iconButton, isActive("/studio") && styles.active)}
            aria-label="Insights"
            title="Insights"
            aria-current={isActive("/studio") ? "page" : undefined}
            data-testid="ws-rail-studio"
          >
            <NotebookPen aria-hidden="true" />
          </Link>

          <button
            type="button"
            className={styles.iconButton}
            aria-label="Search"
            title="Search (⌘K)"
            onClick={openGlobalCommand}
            data-testid="ws-rail-search"
          >
            <Search aria-hidden="true" />
          </button>
        </div>

        <div className={styles.railBottom} data-sidebar-footer>
          <SidebarProfileMenu />
        </div>
      </nav>

      <div
        ref={panelRef}
        className={styles.panel}
        hidden={effectiveCollapsed}
        data-testid="workspace-shell-panel"
      >
        <UnifiedSidebarPanel
          pathname={pathname}
          onCollapse={inSheet ? undefined : toggleCollapsed}
          attentionCount={inboxAttentionCount}
          footer={
            <div className={styles.sidebarFooter} data-sidebar-footer>
              <SidebarProfileMenu />
            </div>
          }
        >
          {panel}
        </UnifiedSidebarPanel>
      </div>
    </aside>
  );
}
