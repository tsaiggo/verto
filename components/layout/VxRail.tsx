"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useMemo, useSyncExternalStore } from "react";
import {
  AtSign,
  BookOpen,
  Bookmark,
  Check,
  CircleHelp,
  Clock3,
  FileText,
  Folder,
  FolderInput,
  LayoutGrid,
  LibraryBig,
  MessageCirclePlus,
  Pin,
  Search,
  SquarePen,
  Tag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ContentDirNode, ContentFileNode } from "@/lib/content-source";
import type { SourceInfo } from "@/lib/source-info";
import { loadBookmarks, subscribeBookmarks } from "@/lib/bookmarks";
import type { Bookmark as BookmarkRecord } from "@/lib/bookmarks";
import { getInboxAttentionCount, loadInbox, subscribeInbox } from "@/lib/inbox";
import {
  parseSetupReadiness,
  setupReadinessSnapshot,
  subscribeSetupReadiness,
  updateOnboardingState,
} from "@/lib/onboarding";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  match?: (pathname: string) => boolean;
}

interface VxRailProps {
  onNavigate?: () => void;
  source?: SourceInfo;
  root?: ContentDirNode;
  fileCount?: number;
}

const PRIMARY: NavItem[] = [
  { href: "/editor", label: "New document", icon: SquarePen },
  { href: "/inbox", label: "Inbox", icon: Clock3 },
  { href: "/library", label: "Library", icon: LibraryBig },
  { href: "/integrations", label: "Sources", icon: AtSign },
  { href: "/studio", label: "Studio", icon: LayoutGrid },
  { href: "/recent", label: "Recent", icon: FileText },
  { href: "/agent", label: "Agent", icon: MessageCirclePlus },
];

const PROJECTS: NavItem[] = [
  { href: "/collections", label: "Collections", icon: BookOpen },
  { href: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { href: "/tags", label: "Tags", icon: Tag },
];

function bookmarkSnapshot(): string {
  return JSON.stringify(loadBookmarks());
}

function isActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({
  item,
  pathname,
  onNavigate,
  nested = false,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const Icon = item.icon;
  const active = isActive(item, pathname);
  return (
    <Link
      href={item.href}
      className={`vx-nav-item${active ? " is-active" : ""}${nested ? " is-nested" : ""}`}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <Icon className="vx-nav-icon" aria-hidden />
      <span className="vx-nav-label">{item.label}</span>
      {item.badge ? <span className="vx-nav-badge">{item.badge}</span> : null}
    </Link>
  );
}

function collectDocuments(
  root?: ContentDirNode,
  output: ContentFileNode[] = []
): ContentFileNode[] {
  if (!root) return output;
  if (root.index && !root.index.hidden && !root.index.draft) output.push(root.index);
  for (const child of root.children) {
    if (child.hidden) continue;
    if (child.type === "file") {
      if (!child.draft) output.push(child);
    } else {
      collectDocuments(child, output);
    }
  }
  return output;
}

function SetupCard({ source, onNavigate }: { source?: SourceInfo; onNavigate?: () => void }) {
  const titleId = useId();
  const buildSourceReady =
    source?.kind !== "local" || source?.label.startsWith("Folder ·") === true;
  const snapshot = useSyncExternalStore(
    subscribeSetupReadiness,
    () => setupReadinessSnapshot(buildSourceReady),
    () =>
      JSON.stringify({
        source: false,
        assistant: false,
        library: false,
        reading: false,
        onboarding: {},
      })
  );
  const readiness = parseSetupReadiness(snapshot);
  const tasks = [
    {
      href: "/integrations",
      label: readiness.source ? "Content source ready" : "Connect a content source",
      icon: readiness.source ? Check : FolderInput,
      done: readiness.source,
    },
    {
      href: "/library",
      label: "Open your library",
      icon: readiness.library ? Check : LibraryBig,
      done: readiness.library,
    },
    {
      href: "/settings/agent",
      label: readiness.assistant ? "Assistant ready" : "Configure the agent",
      icon: readiness.assistant ? Check : MessageCirclePlus,
      done: readiness.assistant,
    },
    {
      href: "/settings/reading",
      label: readiness.reading ? "Reading preferences set" : "Tune reading preferences",
      icon: readiness.reading ? Check : BookOpen,
      done: readiness.reading,
    },
  ];
  const completedCount = tasks.filter((task) => task.done).length;

  return (
    <section className="codex-setup-card" aria-labelledby={titleId}>
      <div className="codex-setup-head">
        <strong id={titleId}>Continue setup</strong>
        <span>
          {completedCount} of {tasks.length}
        </span>
      </div>
      <div className="codex-setup-track" aria-hidden>
        <span style={{ width: `${(completedCount / tasks.length) * 100}%` }} />
      </div>
      <div className="codex-setup-list">
        {tasks.map((task) => {
          const Icon = task.icon;
          return (
            <Link
              key={task.href}
              href={task.href}
              onClick={() => {
                if (task.href === "/library") updateOnboardingState({ libraryOpened: true });
                onNavigate?.();
              }}
            >
              <Icon className={task.done ? "is-done" : ""} aria-hidden />
              <span>{task.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function VxRail({ onNavigate, source, root }: VxRailProps) {
  const pathname = usePathname() ?? "/";
  const headingId = useId();
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
  const documents = useMemo(() => collectDocuments(root).slice(0, 5), [root]);
  const primary = PRIMARY.map((item) =>
    item.href === "/inbox" && inboxAttention > 0
      ? { ...item, badge: inboxAttention.toLocaleString() }
      : item
  );

  return (
    <div className="vx-rail-inner codex-project-rail">
      <div className="codex-rail-brand-row">
        <Link href="/" className="codex-rail-brand" onClick={onNavigate}>
          Codex
        </Link>
        <Link href="/search" className="codex-rail-search" aria-label="Search" onClick={onNavigate}>
          <Search aria-hidden />
        </Link>
      </div>

      <div className="vx-rail-nav-scroll">
        <nav className="vx-nav codex-primary-nav" aria-label="Primary workspace navigation">
          {primary.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </nav>

        <section className="vx-nav-section" aria-labelledby={`${headingId}-projects`}>
          <p id={`${headingId}-projects`} className="vx-nav-heading">
            Projects
          </p>
          <nav className="vx-nav" aria-label="Projects navigation">
            <Link href="/" className="vx-nav-item" onClick={onNavigate}>
              <Folder className="vx-nav-icon" aria-hidden />
              <span className="vx-nav-label">Verto</span>
            </Link>
            {pathname === "/" ? (
              <Link
                href="/"
                className="vx-nav-item is-nested codex-project-task is-active"
                aria-current="page"
                onClick={onNavigate}
              >
                <span className="vx-nav-label">Explore your library</span>
              </Link>
            ) : null}
            {PROJECTS.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
            ))}
          </nav>
        </section>

        {bookmarks.length > 0 ? (
          <section
            className="vx-nav-section codex-tasks-section"
            aria-labelledby={`${headingId}-pinned`}
          >
            <p id={`${headingId}-pinned`} className="vx-nav-heading">
              Pinned
            </p>
            <nav className="vx-nav" aria-label="Pinned documents">
              {bookmarks.slice(0, 3).map((bookmark) => {
                const active = pathname === bookmark.href;
                return (
                  <Link
                    key={bookmark.href}
                    href={bookmark.href}
                    className={`vx-nav-item is-document${active ? " is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    title={bookmark.title}
                  >
                    <Pin className="vx-nav-icon" aria-hidden />
                    <span className="vx-nav-label">{bookmark.title}</span>
                  </Link>
                );
              })}
            </nav>
          </section>
        ) : null}

        <section
          className="vx-nav-section codex-documents-section"
          aria-labelledby={`${headingId}-recent`}
        >
          <p id={`${headingId}-recent`} className="vx-nav-heading">
            Documents
          </p>
          <nav className="vx-nav" aria-label="Workspace documents">
            {documents.map((document) => {
              const active = pathname === document.href;
              return (
                <Link
                  key={document.href}
                  href={document.href}
                  className={`vx-nav-item is-document${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={onNavigate}
                  title={document.title}
                >
                  <FileText className="vx-nav-icon" aria-hidden />
                  <span className="vx-nav-label">{document.title}</span>
                </Link>
              );
            })}
            {documents.length === 0 ? (
              <Link href="/integrations" className="vx-nav-item is-document" onClick={onNavigate}>
                <FolderInput className="vx-nav-icon" aria-hidden />
                <span className="vx-nav-label">Connect your first source</span>
              </Link>
            ) : null}
          </nav>
        </section>
      </div>

      <div className="vx-rail-foot codex-rail-foot">
        <SetupCard source={source} onNavigate={onNavigate} />
        <div className="codex-profile-row">
          <span className="codex-profile-avatar" aria-hidden>
            V
          </span>
          <Link
            href="/settings"
            className="codex-profile-name"
            aria-label="Settings"
            onClick={onNavigate}
            title={source?.label ?? "Local library"}
          >
            Local workspace
          </Link>
          <Link href="/help" className="codex-profile-help" aria-label="Help" onClick={onNavigate}>
            <CircleHelp aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
