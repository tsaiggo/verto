"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bookmark,
  FolderClosed,
  Home,
  Inbox,
  Library,
  Waypoints,
  Settings,
  Sparkles,
  SquareTerminal,
  Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import RailAccount from "@/components/layout/RailAccount";
import VertoMark from "@/components/layout/VertoMark";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match this route and any nested path as active. */
  match?: (pathname: string) => boolean;
}

const PRIMARY: NavItem[] = [
  { href: "/", label: "Home", icon: Home, match: (p) => p === "/" },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  {
    href: "/library",
    label: "Library",
    icon: Library,
    match: (p) => p.startsWith("/library") || p.startsWith("/read"),
  },
  { href: "/collections", label: "Collections", icon: FolderClosed },
  { href: "/tags", label: "Tags", icon: Tag },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/graph", label: "Graph", icon: Waypoints },
];

const TOOLS: NavItem[] = [
  { href: "/agent", label: "Agent", icon: Sparkles },
  { href: "/studio", label: "Knowledge Studio", icon: SquareTerminal },
  { href: "/activity", label: "Activity", icon: Activity },
];

function isActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = isActive(item, pathname);
  return (
    <Link
      href={item.href}
      className={`pnav-link${active ? " is-active" : ""}`}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="pnav-link-icon" aria-hidden />
      <span className="pnav-link-label">{item.label}</span>
    </Link>
  );
}

/**
 * Primary application navigation rail. Persistent across the whole app: the
 * verto wordmark, the primary sections (Home / Inbox / Library / Collections /
 * Tags / Bookmarks / Graph), the agent tools (Agent / Knowledge Studio /
 * Activity), and a footer with Settings + the account control.
 */
export default function PrimaryNav() {
  const pathname = usePathname();

  return (
    <div className="pnav">
      <Link href="/" className="pnav-brand" aria-label="Verto home">
        <VertoMark className="pnav-brand-mark" />
        <span className="pnav-brand-name">verto</span>
      </Link>

      <nav className="pnav-group" aria-label="Primary">
        {PRIMARY.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="pnav-divider" aria-hidden />

      <nav className="pnav-group" aria-label="Tools">
        {TOOLS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="pnav-spacer" />

      <Link
        href="/settings"
        className={`pnav-link${pathname.startsWith("/settings") ? " is-active" : ""}`}
      >
        <Settings className="pnav-link-icon" aria-hidden />
        <span className="pnav-link-label">Settings</span>
      </Link>

      <div className="pnav-account">
        <RailAccount />
      </div>
    </div>
  );
}
