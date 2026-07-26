"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useSyncExternalStore } from "react";
import {
  Bookmark,
  Bot,
  ChevronDown,
  CircleHelp,
  Command,
  FolderInput,
  FolderKanban,
  Home,
  Inbox,
  LibraryBig,
  Monitor,
  Pin,
  Search,
  Settings,
  SquarePen,
  Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PlatformShortcut from "@/components/layout/PlatformShortcut";
import styles from "@/components/layout/VertoShell.module.css";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { loadBookmarks, subscribeBookmarks } from "@/lib/bookmarks";
import type { Bookmark as BookmarkRecord } from "@/lib/bookmarks";
import { getInboxAttentionCount, loadInbox, subscribeInbox } from "@/lib/inbox";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  emphasis?: boolean;
  match?: (pathname: string) => boolean;
}

interface VxRailProps {
  expanded?: boolean;
  onNavigate?: () => void;
}

const PRIMARY_NAVIGATION: NavItem[] = [
  { href: "/", label: "Home", icon: Home, match: (pathname) => pathname === "/" },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  {
    href: "/library",
    label: "Library",
    icon: LibraryBig,
    match: (pathname) => pathname.startsWith("/library") || pathname.startsWith("/read"),
  },
  { href: "/collections", label: "Collections", icon: FolderKanban },
  { href: "/tags", label: "Tags", icon: Tag },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/agent", label: "Agent", icon: Bot, emphasis: true },
  { href: "/studio", label: "Knowledge Studio", icon: Command },
];

const UTILITY_NAVIGATION: NavItem[] = [
  { href: "/integrations", label: "Sources", icon: FolderInput },
  { href: "/runtime/local", label: "Local runtime", icon: Monitor },
  { href: "/settings", label: "Settings", icon: Settings },
];

function bookmarkSnapshot(): string {
  return JSON.stringify(loadBookmarks());
}

function isActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function RailLink({
  expanded,
  item,
  onNavigate,
  pathname,
}: {
  expanded: boolean;
  item: NavItem;
  onNavigate?: () => void;
  pathname: string;
}) {
  const Icon = item.icon;
  const active = isActive(item, pathname);
  const link = (
    <Link
      href={item.href}
      className={cn(
        "vx-nav-item",
        styles.railItem,
        expanded && styles.railItemExpanded,
        active && "is-active",
        active && styles.railItemActive,
        item.emphasis && styles.agentItem
      )}
      aria-current={active ? "page" : undefined}
      aria-label={expanded ? undefined : item.label}
      onClick={onNavigate}
    >
      <Icon className={cn("vx-nav-icon", styles.railIcon)} strokeWidth={1.7} aria-hidden />
      <span className={cn("vx-nav-label", styles.railLabel)}>{item.label}</span>
      {item.badge ? (
        <span className={cn("vx-nav-badge", styles.railBadge)}>{item.badge}</span>
      ) : null}
    </Link>
  );

  if (expanded) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={9}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

function CommandLink({
  expanded,
  href,
  icon: Icon,
  label,
  onNavigate,
  shortcut,
  primary,
}: {
  expanded: boolean;
  href: string;
  icon: LucideIcon;
  label: string;
  onNavigate?: () => void;
  shortcut: "K" | "N";
  primary?: boolean;
}) {
  const link = (
    <Link
      href={href}
      className={cn(
        "vx-command-link",
        styles.railItem,
        styles.commandItem,
        expanded && styles.railItemExpanded,
        primary && styles.commandItemPrimary
      )}
      aria-label={label}
      onClick={onNavigate}
    >
      <Icon className={cn("vx-command-icon", styles.railIcon)} strokeWidth={1.7} aria-hidden />
      <span className={cn("vx-command-label", styles.railLabel)}>{label}</span>
      {expanded ? <PlatformShortcut className={styles.commandShortcut} command={shortcut} /> : null}
    </Link>
  );

  if (expanded) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={9}>
        {label}
        <PlatformShortcut className={styles.tooltipShortcut} command={shortcut} />
      </TooltipContent>
    </Tooltip>
  );
}

function WorkspaceSwitcher({
  expanded,
  onNavigate,
}: {
  expanded: boolean;
  onNavigate?: () => void;
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "vx-workspace-trigger",
                styles.workspaceTrigger,
                expanded && styles.workspaceTriggerExpanded
              )}
              aria-label="Switch workspace"
            >
              <Image
                className={cn("vx-brand-mark", styles.brandMark)}
                src="/icon.png"
                alt=""
                width={26}
                height={26}
                priority
              />
              <span className={cn("vx-brand-name", styles.railLabel)}>Verto</span>
              {expanded ? (
                <ChevronDown className={styles.workspaceChevron} strokeWidth={1.7} aria-hidden />
              ) : null}
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        {!expanded ? (
          <TooltipContent side="right" sideOffset={9}>
            Local workspace
          </TooltipContent>
        ) : null}
      </Tooltip>
      <DropdownMenuContent align="start" sideOffset={8} className={styles.workspaceMenu}>
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

function PinnedDocument({
  bookmark,
  expanded,
  onNavigate,
  pathname,
}: {
  bookmark: BookmarkRecord;
  expanded: boolean;
  onNavigate?: () => void;
  pathname: string;
}) {
  return (
    <RailLink
      expanded={expanded}
      item={{
        href: bookmark.href,
        label: expanded ? bookmark.title : `Pinned: ${bookmark.title}`,
        icon: Pin,
        match: (currentPath) => currentPath === bookmark.href,
      }}
      pathname={pathname}
      onNavigate={onNavigate}
    />
  );
}

/** Compact desktop navigation with an expanded, labeled mobile presentation. */
export default function VxRail({ expanded = false, onNavigate }: VxRailProps) {
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
  const primaryItems = PRIMARY_NAVIGATION.map((item) =>
    item.href === "/inbox" && inboxAttention > 0
      ? { ...item, badge: inboxAttention.toLocaleString() }
      : item
  );

  return (
    <TooltipProvider delayDuration={280} skipDelayDuration={100}>
      <div
        className={cn("vx-rail-inner", styles.railInner, expanded && styles.railInnerExpanded)}
        data-rail-mode={expanded ? "expanded" : "compact"}
      >
        <div className={cn("vx-rail-head", styles.railHead)}>
          <WorkspaceSwitcher expanded={expanded} onNavigate={onNavigate} />
          <div className={styles.commandGroup}>
            <CommandLink
              expanded={expanded}
              href="/search"
              icon={Search}
              label="Search"
              shortcut="K"
              onNavigate={onNavigate}
            />
            <CommandLink
              expanded={expanded}
              href="/editor"
              icon={SquarePen}
              label="New document"
              shortcut="N"
              primary
              onNavigate={onNavigate}
            />
          </div>
        </div>

        <div className={cn("vx-rail-nav-scroll", styles.railScroll)}>
          <nav className={cn("vx-nav", styles.railNavigation)} aria-label="Workspace navigation">
            {primaryItems.map((item) => (
              <RailLink
                key={item.href}
                expanded={expanded}
                item={item}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </nav>

          {bookmarks[0] ? (
            <section className={styles.pinnedSection} aria-label="Pinned document">
              {expanded ? <p className={styles.railSectionLabel}>Pinned</p> : null}
              <PinnedDocument
                bookmark={bookmarks[0]}
                expanded={expanded}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            </section>
          ) : null}
        </div>

        <nav className={cn("vx-rail-foot", styles.railFoot)} aria-label="Workspace utilities">
          {UTILITY_NAVIGATION.map((item) => (
            <RailLink
              key={item.href}
              expanded={expanded}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
          <RailLink
            expanded={expanded}
            item={{ href: "/help", label: "Help", icon: CircleHelp }}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        </nav>
      </div>
    </TooltipProvider>
  );
}
