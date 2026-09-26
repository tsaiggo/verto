"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Bookmark,
  Clock3,
  Folder,
  Home,
  Inbox,
  Layers,
  Mail,
  NotebookPen,
  PanelLeft,
  Puzzle,
  Search,
  StickyNote,
  Tags,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import navStyles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import styles from "./WorkspaceShell.module.css";

const QUICK_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/inbox", label: "RSS Inbox", icon: Inbox },
  { href: "/mail", label: "Mail", icon: Mail },
  { href: "/recent", label: "Recent", icon: Clock3 },
] as const;

const WORKSPACE_LINKS = [
  { href: "/library", label: "Library", icon: Folder },
  { href: "/library?view=notes", label: "Notes", icon: StickyNote },
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
}: {
  href: string;
  label: string;
  icon: typeof Home;
  pathname: string;
  activeView: string | null;
}) {
  const current = isCurrent(pathname, href, activeView);
  return (
    <Link
      href={href}
      className={cn(
        navStyles.navRow,
        styles.unifiedLink,
        href.includes("?view=") && styles.unifiedSubLink,
        current && navStyles.selected
      )}
      aria-current={current ? "page" : undefined}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

function NavigationLinks({
  pathname,
  activeView,
}: {
  pathname: string;
  activeView: string | null;
}) {
  return (
    <nav aria-label="Workspace navigation">
      <div className={styles.unifiedQuickLinks}>
        {QUICK_LINKS.map((item) => (
          <SidebarLink key={item.href} {...item} pathname={pathname} activeView={activeView} />
        ))}
        <span className={cn(navStyles.navRow, styles.unifiedDisabled)} aria-disabled="true">
          <ListTodo aria-hidden="true" />
          <span>Tasks</span>
          <small>Planned</small>
        </span>
      </div>

      <section className={navStyles.navigationSection} aria-labelledby="workspace-links-heading">
        <div className={navStyles.sectionHeading}>
          <h2 id="workspace-links-heading" className={styles.unifiedSectionTitle}>
            WORKSPACE
          </h2>
        </div>
        <div className={navStyles.navList}>
          {WORKSPACE_LINKS.map((item) => (
            <SidebarLink key={item.href} {...item} pathname={pathname} activeView={activeView} />
          ))}
        </div>
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
  return (
    <div className={styles.unifiedPanel} data-testid="workspace-unified-panel">
      <header className={navStyles.brandRow}>
        <Link href="/" className={styles.workspaceIdentity} aria-label="Verto workspace home">
          <span className={navStyles.gradientMark} aria-hidden="true" />
          <strong>Verto</strong>
        </Link>
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
        <div className={styles.unifiedSearch}>
          <button
            type="button"
            className={cn(navStyles.commandButton, styles.unifiedSearchButton)}
            onClick={openGlobalCommand}
            aria-label="Open command palette"
          >
            <Search aria-hidden="true" />
            <span>Search</span>
            <kbd>⌘ K</kbd>
          </button>
        </div>

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
