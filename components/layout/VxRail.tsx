"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Bookmark,
  ChevronDown,
  CircleHelp,
  Clock3,
  Command,
  FolderInput,
  FolderKanban,
  Home,
  Inbox,
  LibraryBig,
  MessageSquare,
  Monitor,
  Pin,
  Search,
  Settings,
  SquarePen,
  Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { loadBookmarks, subscribeBookmarks } from "@/lib/bookmarks";
import type { Bookmark as BookmarkRecord } from "@/lib/bookmarks";
import { getInboxAttentionCount, loadInbox, subscribeInbox } from "@/lib/inbox";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  match?: (p: string) => boolean;
}

const QUICK_ACCESS: NavItem[] = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/agent", label: "Agent", icon: MessageSquare },
  {
    href: "/library",
    label: "Library",
    icon: LibraryBig,
    match: (p) => p.startsWith("/library") || p.startsWith("/read"),
  },
];

const WORKSPACE: NavItem[] = [
  { href: "/", label: "Home", icon: Home, match: (p) => p === "/" },
  { href: "/collections", label: "Collections", icon: FolderKanban },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/studio", label: "Knowledge Studio", icon: Command },
  { href: "/tags", label: "Tags", icon: Tag },
  { href: "/recent", label: "Recent", icon: Clock3 },
];

const CONFIGURE: NavItem[] = [
  { href: "/runtime/local", label: "Runtime", icon: Monitor },
  { href: "/integrations", label: "Sources", icon: FolderInput },
  { href: "/settings", label: "Settings", icon: Settings },
];

function bookmarkSnapshot(): string {
  return JSON.stringify(loadBookmarks());
}

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

function NavSection({
  label,
  items,
  pathname,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const headingId = `vx-nav-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <section className="vx-nav-section" aria-labelledby={headingId}>
      <p id={headingId} className="vx-nav-heading">
        {label}
      </p>
      <nav className="vx-nav" aria-label={`${label} navigation`}>
        {items.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </nav>
    </section>
  );
}

function PinnedSection({
  bookmarks,
  pathname,
  onNavigate,
}: {
  bookmarks: BookmarkRecord[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const headingId = "vx-nav-pinned";
  const pinned = bookmarks[0];
  const active = pinned ? pathname === pinned.href : false;

  return (
    <section className="vx-pinned-section" aria-labelledby={headingId}>
      <button
        id={headingId}
        type="button"
        className="vx-section-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>Pinned</span>
        <ChevronDown className={open ? "is-open" : undefined} aria-hidden />
      </button>
      {open ? (
        pinned ? (
          <Link
            href={pinned.href}
            className={`vx-nav-item vx-pinned-item${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
            title={pinned.title}
            onClick={onNavigate}
          >
            <Pin className="vx-nav-icon vx-pinned-icon" aria-hidden />
            <span className="vx-nav-label">{pinned.title}</span>
          </Link>
        ) : (
          <div className="vx-pinned-empty" aria-label="No pinned documents">
            <Pin className="vx-nav-icon" aria-hidden />
            <span>No pinned documents</span>
          </div>
        )
      ) : null}
    </section>
  );
}

function WorkspaceSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="vx-workspace-trigger" aria-label="Switch workspace">
          <Image className="vx-brand-mark" src="/icon.png" alt="" width={24} height={24} priority />
          <span className="vx-brand-name">verto</span>
          <ChevronDown className="vx-workspace-chevron" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="vx-workspace-menu">
        <DropdownMenuLabel>Local workspace</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/" onClick={onNavigate}>
            <Home aria-hidden /> Home
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/integrations" onClick={onNavigate}>
            <FolderInput aria-hidden /> Sources
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" onClick={onNavigate}>
            <Settings aria-hidden /> Settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Desktop-first rail, structured to mirror the supplied restrained workspace reference. */
export default function VxRail({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/";
  const inboxAttention = useSyncExternalStore(
    subscribeInbox,
    () => getInboxAttentionCount(loadInbox().items),
    () => 0
  );
  const storedBookmarks = useSyncExternalStore(subscribeBookmarks, bookmarkSnapshot, () => "[]");
  const bookmarks = useMemo(
    () => JSON.parse(storedBookmarks) as BookmarkRecord[],
    [storedBookmarks]
  );
  const quickAccess = QUICK_ACCESS.map((item) =>
    item.href === "/inbox" && inboxAttention > 0
      ? { ...item, badge: inboxAttention.toLocaleString() }
      : item
  );

  return (
    <div className="vx-rail-inner">
      <div className="vx-rail-head">
        <WorkspaceSwitcher onNavigate={onNavigate} />

        <Link href="/search" className="vx-command-link" aria-label="Search" onClick={onNavigate}>
          <Search className="vx-command-icon" aria-hidden />
          <span className="vx-command-label">Search…</span>
          <kbd className="vx-command-kbd" aria-hidden>
            ⌘K
          </kbd>
        </Link>
        <Link
          href="/editor"
          className="vx-command-link vx-new-link"
          aria-label="New document"
          onClick={onNavigate}
        >
          <SquarePen className="vx-command-icon" aria-hidden />
          <span className="vx-command-label">New document</span>
          <kbd className="vx-command-kbd" aria-hidden>
            ⌘N
          </kbd>
        </Link>
      </div>

      <div className="vx-rail-nav-scroll">
        <nav className="vx-nav vx-quick-nav" aria-label="Quick access navigation">
          {quickAccess.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </nav>
        <PinnedSection bookmarks={bookmarks} pathname={pathname} onNavigate={onNavigate} />
        <NavSection
          label="Workspace"
          items={WORKSPACE}
          pathname={pathname}
          onNavigate={onNavigate}
        />
        <NavSection
          label="Configure"
          items={CONFIGURE}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      </div>

      <div className="vx-rail-foot">
        <Link href="/help" className="vx-help-link" aria-label="Help" onClick={onNavigate}>
          <CircleHelp aria-hidden />
        </Link>
      </div>
    </div>
  );
}
