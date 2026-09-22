"use client";

/**
 * WorkspaceShell — FULL original design-labs workspace aside (rail 56 + panel 232 as one <aside> unit, total 288 expanded / 56 collapsed)
 * DESIGN.md v2 contract: 56+232 anatomy becomes 288-unit aside (56 rail + 232 panel)
 * Forks original WorkspaceSidebar structure, NOT the panel-only adapter.
 * Tokens: cold v2 only (Inter/system, #e9eaee borders, #6B6B67 muted, #2563EB focus, #D97706 warning if surfaced)
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Folder,
  Home,
  Layers,
  MessageCircle,
  Puzzle,
  Search,
  Settings2,
  UserCircle,
  Users,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./WorkspaceShell.module.css";

export const WORKSPACE_SHELL_COLLAPSED_KEY = "verto:labs-sidebar:collapsed";

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

function resolveAppliedTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  if (document.documentElement.classList.contains("dark")) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredThemeChoice(): "light" | "dark" | "system" {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return "system";
}

export interface WorkspaceShellProps {
  panel: React.ReactNode;
  defaultCollapsed?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  inSheet?: boolean;
  className?: string;
}

// eslint-disable-next-line complexity, max-lines-per-function -- workspace shell composes full rail+panel with theme toggle, active matching, collapse persistence
export default function WorkspaceShell({
  panel,
  defaultCollapsed = false,
  collapsed: controlledCollapsed,
  onToggleCollapsed,
  inSheet = false,
  className,
}: WorkspaceShellProps) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() =>
    inSheet ? false : readCollapsedFromStorage(defaultCollapsed)
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync persisted collapsed state after hydration
    if (!inSheet && controlledCollapsed === undefined) setInternalCollapsed(readCollapsedFromStorage(defaultCollapsed));
  }, [defaultCollapsed, inSheet, controlledCollapsed]);

  const isControlled = controlledCollapsed !== undefined && !inSheet;
  const collapsed = isControlled ? (controlledCollapsed as boolean) : inSheet ? false : internalCollapsed;

  const toggleCollapsed = useCallback(() => {
    if (inSheet) return;
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
      // Mirror VxRail semantics + spec's Projects grouping
      if (href === "/") return pathname === "/";
      if (href === "/library") return pathname.startsWith("/library") || pathname.startsWith("/read");
      if (href === "/settings") return pathname === "/settings" || pathname.startsWith("/settings/");
      if (href === "/integrations") return pathname === "/integrations" || pathname.startsWith("/integrations/");
      if (href === "/recent") return pathname === "/recent" || pathname.startsWith("/recent/");
      return pathname === href || pathname.startsWith(`${href}/`);
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

  const toggleTheme = useCallback(() => {
    if (typeof window === "undefined") return;
    const choice = getStoredThemeChoice();
    const applied = choice === "system" ? resolveAppliedTheme() : choice;
    const next: "light" | "dark" = applied === "dark" ? "light" : "dark";
    // Persist as explicit choice (not system) to make toggle deterministic
    window.localStorage.setItem("theme", next);
    window.dispatchEvent(new StorageEvent("storage", { key: "theme" }));
    document.documentElement.classList.toggle("dark", next === "dark");
  }, []);

  const effectiveCollapsed = inSheet ? false : collapsed;

  // Hydrate-safe: before mount, avoid flash by using SSR fallback (expanded). After mount, apply stored value.
  const asideCollapsedClass = effectiveCollapsed ? styles.isCollapsed : "";

  return (
    <aside
      className={cn(styles.root, asideCollapsedClass, inSheet && styles.inSheet, className)}
      aria-label="Main navigation"
      data-shell-rail
      data-collapsed={effectiveCollapsed ? "true" : "false"}
      data-testid={inSheet ? "workspace-shell-sheet" : "workspace-shell"}
    >
      <nav className={styles.rail} aria-label="App navigation">
        <button
          type="button"
          className={styles.brand}
          aria-label={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleCollapsed}
          data-testid="workspace-shell-brand"
        >
          <Layers aria-hidden="true" />
        </button>

        <div className={styles.railLinks} role="list">
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

          {/* Search -> opens global CommandDialog */}
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

          {/* Updates -> /recent */}
          <Link
            href="/recent"
            className={cn(styles.iconButton, isActive("/recent") && styles.active)}
            aria-label="Updates"
            title="Updates"
            aria-current={isActive("/recent") ? "page" : undefined}
            data-testid="ws-rail-updates"
          >
            <Bell aria-hidden="true" />
          </Link>

          {/* Projects -> /library (active on /library* + /read*) */}
          <Link
            href="/library"
            className={cn(styles.iconButton, isActive("/library") && styles.active)}
            aria-label="Projects"
            title="Projects"
            aria-current={isActive("/library") ? "page" : undefined}
            data-testid="ws-rail-projects"
          >
            <Folder aria-hidden="true" />
          </Link>

          {/* Messages -> DISABLED */}
          <button type="button" className={styles.iconButton} disabled aria-label="Messages" title="Not available yet" data-testid="ws-rail-messages">
            <MessageCircle aria-hidden="true" />
          </button>

          {/* Calendar -> DISABLED */}
          <button
            type="button"
            className={styles.iconButton}
            disabled
            aria-label="Calendar"
            title="Not available yet"
            data-testid="ws-rail-calendar"
          >
            <CalendarDays aria-hidden="true" />
          </button>

          {/* Teams -> DISABLED */}
          <button type="button" className={styles.iconButton} disabled aria-label="Teams" title="Not available yet" data-testid="ws-rail-teams">
            <Users aria-hidden="true" />
          </button>

          {/* Integrations -> /integrations */}
          <Link
            href="/integrations"
            className={cn(styles.iconButton, isActive("/integrations") && styles.active)}
            aria-label="Integrations"
            title="Integrations"
            aria-current={isActive("/integrations") ? "page" : undefined}
            data-testid="ws-rail-integrations"
          >
            <Puzzle aria-hidden="true" />
          </Link>
        </div>

        <div className={styles.railBottom}>
          {/* Appearance -> toggles theme */}
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Appearance"
            title="Toggle theme"
            onClick={toggleTheme}
            data-testid="ws-rail-appearance"
          >
            <Sun aria-hidden="true" />
          </button>

          {/* Account -> /settings */}
          <Link
            href="/settings"
            className={cn(styles.iconButton, isActive("/settings") && styles.active)}
            aria-label="Account"
            title="Account"
            data-testid="ws-rail-account"
          >
            <UserCircle aria-hidden="true" />
          </Link>

          {/* Settings -> /settings (active on /settings*) */}
          <Link
            href="/settings"
            className={cn(styles.iconButton, isActive("/settings") && styles.active)}
            aria-label="Settings"
            title="Settings"
            aria-current={isActive("/settings") ? "page" : undefined}
            data-testid="ws-rail-settings"
          >
            <Settings2 aria-hidden="true" />
          </Link>

          {/* avatar-button gradient-mark */}
          <button
            type="button"
            className={styles.avatarButton}
            aria-label="Open profile"
            title="Profile"
            onClick={() => router.push("/settings")}
            data-testid="ws-rail-avatar"
          >
            <span className={styles.gradientMark} aria-hidden="true" />
          </button>
        </div>
      </nav>

      {!effectiveCollapsed && <div className={styles.panel} data-testid="workspace-shell-panel">{panel}</div>}
    </aside>
  );
}
