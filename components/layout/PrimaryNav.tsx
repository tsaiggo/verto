"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  Bookmark,
  Clock3,
  FolderClosed,
  FolderInput,
  Home,
  Inbox,
  Library,
  Search,
  Settings,
  Sparkles,
  SquareTerminal,
  Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import RailAccount from "@/components/layout/RailAccount";
import VertoMark from "@/components/layout/VertoMark";
import { getInboxAttentionCount, loadInbox, subscribeInbox } from "@/lib/inbox";
import { resolveShellSurface } from "@/lib/shell-surfaces";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
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
];

const TOOLS: NavItem[] = [
  { href: "/agent", label: "Agent", icon: Sparkles },
  { href: "/studio", label: "Knowledge Studio", icon: SquareTerminal },
];

/** Compact reading-mode primary nav (matches the reader board's text rail). */
const READER_PRIMARY: NavItem[] = [
  { href: "/", label: "Home", icon: Home, match: (p) => p === "/" },
  { href: "/library", label: "Library", icon: Library },
  { href: "/collections", label: "Collections", icon: FolderClosed },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/recent", label: "Recent", icon: Clock3 },
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
      title={item.label}
    >
      <Icon className="pnav-link-icon" aria-hidden />
      <span className="pnav-link-label">{item.label}</span>
      {item.badge && <span className="pnav-badge">{item.badge}</span>}
    </Link>
  );
}

/**
 * Primary application navigation rail. Persistent across the whole app: the
 * verto wordmark, the primary sections (Home / Inbox / Library / Collections /
 * Tags / Bookmarks), the agent tools, and a footer with Settings + the
 * account control.
 *
 * The rail adapts to the surface: the home dashboard expands to a full labelled
 * sidebar; the reader uses a compact text rail (primary sections + a Collections
 * list) matching the reader board; every other surface collapses to the 64px
 * icon rail described in the App Shell Anatomy.
 */
export default function PrimaryNav() {
  const pathname = usePathname() ?? "/";
  const inboxAttention = useSyncExternalStore(
    subscribeInbox,
    () => getInboxAttentionCount(loadInbox().items),
    () => 0
  );
  const shellSurface = resolveShellSurface(pathname);
  const isHome = shellSurface.primaryNavVariant === "home";
  const isReader = shellSurface.primaryNavVariant === "reader";

  if (isReader) {
    return (
      <div className="pnav pnav--reader">
        <div className="pnav-brand-row">
          <Link href="/" className="pnav-brand" aria-label="Verto home">
            <VertoMark className="pnav-brand-mark" />
            <span className="pnav-brand-name">Verto</span>
          </Link>
        </div>

        <Link href="/search" className="pnav-search">
          <Search aria-hidden />
          <span>Search</span>
          <span className="pnav-kbd" aria-hidden>
            ⌘ K
          </span>
        </Link>

        <nav className="pnav-group" aria-label="Primary">
          {READER_PRIMARY.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        <div className="pnav-spacer" />

        <div className="pnav-account">
          <RailAccount />
        </div>
      </div>
    );
  }

  const isCompact = shellSurface.primaryNavVariant === "compact";
  const primaryItems = PRIMARY.map((item) =>
    item.href === "/inbox" && inboxAttention > 0
      ? { ...item, badge: inboxAttention.toLocaleString() }
      : item
  );

  return (
    <div className={`pnav${isHome ? " pnav--home" : " pnav--compact"}`}>
      <div className="pnav-brand-row">
        <Link href="/" className="pnav-brand" aria-label="Verto home">
          <VertoMark className="pnav-brand-mark" />
          <span className="pnav-brand-name">Verto</span>
        </Link>
      </div>

      {!isCompact && (
        <Link href="/search" className="pnav-search">
          <Search aria-hidden />
          <span>Search anything...</span>
          <span className="pnav-kbd" aria-hidden>
            ⌘ K
          </span>
        </Link>
      )}

      <nav className="pnav-group" aria-label="Primary">
        {primaryItems.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="pnav-divider" aria-hidden />

      <nav className="pnav-group" aria-label="Tools">
        {TOOLS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      <Link
        href="/integrations"
        className={`pnav-link${pathname.startsWith("/integrations") ? " is-active" : ""}`}
        title="Sources"
      >
        <FolderInput className="pnav-link-icon" aria-hidden />
        <span className="pnav-link-label">Sources</span>
      </Link>

      <Link
        href="/settings"
        className={`pnav-link${pathname.startsWith("/settings") ? " is-active" : ""}`}
        title="Settings"
      >
        <Settings className="pnav-link-icon" aria-hidden />
        <span className="pnav-link-label">Settings</span>
      </Link>

      <div className="pnav-spacer" />

      <div className="pnav-account">
        <RailAccount />
      </div>
    </div>
  );
}
