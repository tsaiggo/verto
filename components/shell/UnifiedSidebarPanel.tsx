"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import MailViewLink from "@/components/mail/MailViewLink";
import { useSearchParams } from "next/navigation";
import {
  Bookmark,
  ChevronDown,
  Clock3,
  Command,
  Folder,
  Home,
  Inbox,
  Layers,
  Mail,
  NotebookPen,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Puzzle,
  Tags,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isTauri } from "@/lib/tauri";
import navStyles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import styles from "./WorkspaceShell.module.css";

const QUICK_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/recent", label: "Recent", icon: Clock3 },
  { href: "/inbox", label: "RSS Inbox", icon: Inbox },
  { href: "/mail", label: "Mail", icon: Mail },
] as const;

const WORKSPACE_LINKS = [
  { href: "/studio", label: "Knowledge Studio", icon: NotebookPen },
  { href: "/collections", label: "Collections", icon: Layers },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/tags", label: "Tags", icon: Tags },
  { href: "/integrations", label: "Sources", icon: Puzzle },
] as const;

function isCurrent(pathname: string, href: string, activeView: string | null): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/library?view=notes") return pathname === "/library" && activeView === "notes";
  if (href === "/library") {
    return (
      pathname.startsWith("/read") || (pathname.startsWith("/library") && activeView !== "notes")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
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
  withDisclosure = false,
}: {
  href: string;
  label: string;
  icon?: typeof Home;
  pathname: string;
  activeView: string | null;
  withDisclosure?: boolean;
}) {
  const current = isCurrent(pathname, href, activeView);
  const NavigationLink = href === "/mail" ? MailViewLink : Link;
  return (
    <NavigationLink
      href={href}
      className={cn(
        navStyles.navRow,
        styles.unifiedLink,
        href.includes("?view=") && styles.unifiedChildRow,
        withDisclosure && navStyles.hasAction,
        current && navStyles.selected
      )}
      aria-current={current ? "page" : undefined}
    >
      {Icon && <Icon aria-hidden="true" />}
      <span>{label}</span>
    </NavigationLink>
  );
}

function NavigationLinks({
  pathname,
  activeView,
}: {
  pathname: string;
  activeView: string | null;
}) {
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true);
  const [libraryExpanded, setLibraryExpanded] = useState(true);

  return (
    <nav aria-label="Workspace navigation">
      <div className={styles.unifiedPrimaryNavigation}>
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
          {QUICK_LINKS.map((item) => (
            <SidebarLink key={item.href} {...item} pathname={pathname} activeView={activeView} />
          ))}
        </div>
      </div>

      <section className={navStyles.navigationSection} aria-labelledby="workspace-links-heading">
        <div className={navStyles.sectionHeading}>
          <button
            type="button"
            className={navStyles.sectionTitle}
            aria-expanded={workspaceExpanded}
            aria-controls="workspace-links-content"
            onClick={() => setWorkspaceExpanded((expanded) => !expanded)}
          >
            <ChevronDown className={workspaceExpanded ? "" : navStyles.turned} aria-hidden="true" />
            <span id="workspace-links-heading">Workspace</span>
          </button>
          <details className={navStyles.sectionOptions}>
            <summary aria-label="Workspace options" title="Workspace options">
              <MoreHorizontal aria-hidden="true" />
            </summary>
            <div className={navStyles.sectionOptionsMenu}>
              <button
                type="button"
                onClick={(event) => {
                  setWorkspaceExpanded(true);
                  setLibraryExpanded(true);
                  event.currentTarget.closest("details")?.removeAttribute("open");
                }}
              >
                Expand all
              </button>
              <button
                type="button"
                onClick={(event) => {
                  setWorkspaceExpanded(false);
                  event.currentTarget.closest("details")?.removeAttribute("open");
                }}
              >
                Collapse all
              </button>
            </div>
          </details>
          <Link
            href={isTauri() ? "/editor?managed=1" : "/editor"}
            className={navStyles.sectionAdd}
            aria-label="New note"
            title="New note"
          >
            <Plus aria-hidden="true" />
          </Link>
        </div>
        {workspaceExpanded && (
          <div id="workspace-links-content" className={navStyles.navList}>
            <div className={styles.unifiedNavigationItem}>
              <SidebarLink
                href="/library"
                label="Library"
                icon={Folder}
                pathname={pathname}
                activeView={activeView}
                withDisclosure
              />
              <button
                type="button"
                className={cn(
                  styles.unifiedDisclosure,
                  libraryExpanded && styles.unifiedDisclosureOpen
                )}
                aria-label={`${libraryExpanded ? "Collapse" : "Expand"} Library navigation`}
                aria-expanded={libraryExpanded}
                aria-controls="workspace-library-children"
                onClick={() => setLibraryExpanded((expanded) => !expanded)}
              >
                <ChevronDown aria-hidden="true" />
              </button>
            </div>
            {libraryExpanded && (
              <div id="workspace-library-children">
                <SidebarLink
                  href="/library?view=notes"
                  label="Notes"
                  pathname={pathname}
                  activeView={activeView}
                />
              </div>
            )}
            {WORKSPACE_LINKS.map((item) => (
              <SidebarLink key={item.href} {...item} pathname={pathname} activeView={activeView} />
            ))}
            <span className={cn(navStyles.navRow, styles.unifiedDisabled)} aria-disabled="true">
              <ListTodo aria-hidden="true" />
              <span>Tasks</span>
              <small>Planned</small>
            </span>
          </div>
        )}
      </section>
    </nav>
  );
}

function CurrentNavigation({ pathname }: { pathname: string }) {
  const activeView = useSearchParams()?.get("view") ?? null;
  return <NavigationLinks pathname={pathname} activeView={activeView} />;
}

export default function UnifiedSidebarPanel({
  pathname,
  onCollapse,
  children,
}: {
  pathname: string;
  onCollapse: () => void;
  children: React.ReactNode;
}) {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  return (
    <div className={styles.unifiedPanel} data-testid="workspace-unified-panel">
      <header className={navStyles.brandRow}>
        <div className={navStyles.workspaceSwitch}>
          <button
            type="button"
            className={navStyles.workspaceButton}
            aria-label="Verto workspace menu"
            aria-haspopup="menu"
            aria-expanded={workspaceMenuOpen}
            onClick={() => setWorkspaceMenuOpen((open) => !open)}
          >
            <span className={navStyles.gradientMark} aria-hidden="true" />
            <strong>Verto</strong>
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          {workspaceMenuOpen && (
            <div className={navStyles.workspaceMenu} role="menu">
              <span>Your workspace</span>
              <Link href="/" role="menuitem" onClick={() => setWorkspaceMenuOpen(false)}>
                <span className={navStyles.gradientMark} aria-hidden="true" />
                Verto <span className={navStyles.currentDot} aria-hidden="true" />
              </Link>
              <Link
                href="/integrations"
                role="menuitem"
                onClick={() => setWorkspaceMenuOpen(false)}
              >
                Manage sources
              </Link>
            </div>
          )}
        </div>
        <button
          type="button"
          className={navStyles.smallButton}
          aria-label="Collapse sidebar"
          onClick={onCollapse}
          data-testid="workspace-panel-collapse"
        >
          <PanelLeft aria-hidden="true" />
        </button>
      </header>

      <div className={styles.unifiedScroll}>
        <Suspense fallback={<NavigationLinks pathname={pathname} activeView={null} />}>
          <CurrentNavigation pathname={pathname} />
        </Suspense>

        <div className={styles.contextPanel} data-unified-sidebar-context>
          {children}
        </div>
      </div>
    </div>
  );
}
