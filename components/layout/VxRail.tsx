"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Command,
  FolderInput,
  Home,
  Inbox,
  Diamond,
  LibraryBig,
  Settings,
  Sparkles,
  Square,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import VxAccount from "@/components/layout/VxAccount";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  match?: (p: string) => boolean;
}

const PRIMARY: NavItem[] = [
  { href: "/", label: "Home", icon: Home, match: (p) => p === "/" },
  { href: "/inbox", label: "Inbox", icon: Inbox, badge: "6" },
  {
    href: "/library",
    label: "Library",
    icon: LibraryBig,
    match: (p) => p.startsWith("/library") || p.startsWith("/read"),
  },
  { href: "/collections", label: "Collections", icon: Square },
  { href: "/tags", label: "Tags", icon: Diamond },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
];

const TOOLS: NavItem[] = [
  { href: "/agent", label: "Agent", icon: Sparkles },
  { href: "/studio", label: "Knowledge Studio", icon: Command },
];

function isActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isActive(item, pathname);
  return (
    <Link
      href={item.href}
      className={`vx-nav-item${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <Icon className="vx-nav-icon" aria-hidden />
      <span className="vx-nav-label">{item.label}</span>
      {item.badge && <span className="vx-nav-badge">{item.badge}</span>}
    </Link>
  );
}

/**
 * Redesign primary rail — a persistent 252px labelled sidebar shown on every
 * product surface (App Shell Anatomy). Wordmark, primary sections, agent tools,
 * then a footer with Settings and the account control.
 */
export default function VxRail({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/";
  const settingsActive = pathname.startsWith("/settings");
  return (
    <div className="vx-rail-inner" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <Link href="/" className="vx-brand" aria-label="Verto home" onClick={onNavigate}>
        <span className="vx-brand-mark">V</span>
        <span>verto</span>
      </Link>

      <nav className="vx-nav" aria-label="Primary">
        {PRIMARY.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="vx-nav-sep" aria-hidden />

      <nav className="vx-nav" aria-label="Tools">
        {TOOLS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="vx-rail-spacer" />

      <div className="vx-rail-foot">
        <Link
          href="/integrations"
          className={`vx-nav-item${pathname.startsWith("/integrations") ? " is-active" : ""}`}
          onClick={onNavigate}
        >
          <FolderInput className="vx-nav-icon" aria-hidden />
          <span className="vx-nav-label">Sources</span>
        </Link>
        <Link
          href="/settings"
          className={`vx-nav-item${settingsActive ? " is-active" : ""}`}
          onClick={onNavigate}
        >
          <Settings className="vx-nav-icon" aria-hidden />
          <span className="vx-nav-label">Settings</span>
        </Link>
        <VxAccount />
      </div>
    </div>
  );
}
