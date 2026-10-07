"use client";

import { Suspense, useId, useState } from "react";
import Link from "next/link";
import MailViewLink from "@/components/mail/MailViewLink";
import { useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Command,
  Folder,
  Home,
  Inbox,
  NotebookPen,
  PanelLeft,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isTauri } from "@/lib/tauri";
import navStyles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import styles from "./WorkspaceShell.module.css";

const GROUPS = [
  {
    href: "/",
    label: "Home",
    icon: Home,
    routes: ["/", "/recent"],
    children: [{ href: "/recent", label: "Recent" }],
  },
  {
    href: "/library",
    label: "Library",
    icon: Folder,
    routes: ["/library", "/read", "/editor", "/collections", "/bookmarks", "/tags"],
    children: [
      { href: "/library?view=notes", label: "Notes" },
      { href: "/collections", label: "Collections" },
      { href: "/bookmarks", label: "Bookmarks" },
      { href: "/tags", label: "Tags" },
    ],
  },
  {
    href: "/inbox",
    label: "Inbox",
    icon: Inbox,
    routes: ["/inbox", "/mail"],
    children: [
      { href: "/inbox", label: "RSS Inbox" },
      { href: "/mail", label: "Mail" },
    ],
  },
] as const;

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || (route !== "/" && pathname.startsWith(`${route}/`));
}

function isCurrent(pathname: string, href: string, activeView: string | null): boolean {
  if (href === "/library?view=notes") return pathname === "/library" && activeView === "notes";
  if (href === "/library") return pathname === "/library" && activeView !== "notes";
  return matchesRoute(pathname, href);
}

function openGlobalCommand() {
  const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
  trigger?.click();
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  pathname,
  activeView,
  active,
  secondary = false,
  current = isCurrent(pathname, href, activeView),
  attentionCount = 0,
}: {
  href: string;
  label: string;
  icon?: typeof Home;
  pathname: string;
  activeView: string | null;
  active?: boolean;
  secondary?: boolean;
  current?: boolean;
  attentionCount?: number;
}) {
  const NavigationLink = href === "/mail" ? MailViewLink : Link;
  const attentionId = useId();
  return (
    <NavigationLink
      href={href}
      className={cn(
        navStyles.navRow,
        styles.unifiedLink,
        secondary && styles.unifiedChildRow,
        (active ?? current) && navStyles.selected
      )}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      aria-describedby={attentionCount > 0 ? attentionId : undefined}
      data-active={(active ?? current) ? "true" : undefined}
      data-navigation-level={secondary ? "secondary" : "primary"}
    >
      {Icon && <Icon aria-hidden="true" />}
      <span>{label}</span>
      {attentionCount > 0 && (
        <span className={styles.navigationBadge}>
          <span aria-hidden="true">{attentionCount > 99 ? "99+" : attentionCount}</span>
          <span id={attentionId} className="sr-only">
            {attentionCount} items need attention
          </span>
        </span>
      )}
    </NavigationLink>
  );
}

function NavigationGroup({
  group,
  pathname,
  activeView,
  attentionCount,
}: {
  group: (typeof GROUPS)[number];
  pathname: string;
  activeView: string | null;
  attentionCount: number;
}) {
  const active = group.routes.some((route) => matchesRoute(pathname, route));
  const [expanded, setExpanded] = useState(active);
  const childrenId = useId();
  const isLibrary = group.label === "Library";
  return (
    <div data-navigation-group={group.label}>
      <div className={styles.unifiedNavigationItem}>
        <SidebarLink
          href={group.href}
          label={group.label}
          icon={group.icon}
          pathname={pathname}
          activeView={activeView}
          active={active}
          attentionCount={group.label === "Inbox" ? attentionCount : 0}
          current={group.label === "Inbox" ? false : isCurrent(pathname, group.href, activeView)}
        />
        {isLibrary && (
          <Link
            href={isTauri() ? "/editor?managed=1" : "/editor"}
            className={cn(styles.unifiedDisclosure, styles.unifiedAdd)}
            aria-label="New note"
            title="New note"
          >
            <Plus aria-hidden="true" />
          </Link>
        )}
        <button
          type="button"
          className={cn(styles.unifiedDisclosure, expanded && styles.unifiedDisclosureOpen)}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${group.label} navigation`}
          aria-expanded={expanded}
          aria-controls={expanded ? childrenId : undefined}
          onClick={() => setExpanded((value) => !value)}
        >
          <ChevronDown aria-hidden="true" />
        </button>
      </div>
      {expanded && (
        <div id={childrenId} className={styles.unifiedChildren}>
          {isLibrary && (
            <Link
              href={isTauri() ? "/editor?managed=1" : "/editor"}
              className={cn(
                navStyles.navRow,
                styles.unifiedLink,
                styles.unifiedChildRow,
                styles.unifiedMobileNewNote
              )}
              data-navigation-level="secondary"
            >
              <span>New note</span>
            </Link>
          )}
          {group.children.map((item) => (
            <SidebarLink
              key={item.href}
              {...item}
              pathname={pathname}
              activeView={activeView}
              secondary
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NavigationLinks({
  pathname,
  activeView,
  attentionCount,
}: {
  pathname: string;
  activeView: string | null;
  attentionCount: number;
}) {
  return (
    <nav aria-label="Workspace navigation" className={styles.unifiedPrimaryNavigation}>
      <button
        type="button"
        className={navStyles.commandButton}
        onClick={openGlobalCommand}
        aria-label="Open command palette"
      >
        <Command aria-hidden="true" />
        <span>Command</span>
        <kbd>⌘ K</kbd>
      </button>
      <div className={styles.unifiedQuickLinks}>
        {GROUPS.map((group) => (
          <NavigationGroup
            key={group.href}
            group={group}
            pathname={pathname}
            activeView={activeView}
            attentionCount={attentionCount}
          />
        ))}
        <SidebarLink
          href="/studio"
          label="Insights"
          icon={NotebookPen}
          pathname={pathname}
          activeView={activeView}
        />
      </div>
    </nav>
  );
}

function CurrentNavigation({
  pathname,
  attentionCount,
}: {
  pathname: string;
  attentionCount: number;
}) {
  const activeView = useSearchParams()?.get("view") ?? null;
  return (
    <NavigationLinks
      key={`${pathname}:${activeView}`}
      pathname={pathname}
      activeView={activeView}
      attentionCount={attentionCount}
    />
  );
}

export default function UnifiedSidebarPanel({
  pathname,
  onCollapse,
  children,
  attentionCount,
  footer,
}: {
  pathname: string;
  onCollapse?: () => void;
  children: React.ReactNode;
  attentionCount: number;
  footer: React.ReactNode;
}) {
  return (
    <div className={styles.unifiedPanel} data-testid="workspace-unified-panel">
      <header className={navStyles.brandRow}>
        <Link href="/" className={styles.sidebarWordmark}>
          Verto
        </Link>
        {onCollapse && (
          <button
            type="button"
            className={navStyles.smallButton}
            aria-label="Collapse sidebar"
            onClick={onCollapse}
            data-testid="workspace-panel-collapse"
            data-sidebar-toggle
            aria-expanded="true"
          >
            <PanelLeft aria-hidden="true" />
          </button>
        )}
      </header>
      <div className={styles.unifiedScroll}>
        <Suspense
          fallback={
            <NavigationLinks
              pathname={pathname}
              activeView={null}
              attentionCount={attentionCount}
            />
          }
        >
          <CurrentNavigation pathname={pathname} attentionCount={attentionCount} />
        </Suspense>
        {children && (
          <div className={styles.contextPanel} data-unified-sidebar-context>
            {children}
          </div>
        )}
      </div>
      {footer}
    </div>
  );
}
