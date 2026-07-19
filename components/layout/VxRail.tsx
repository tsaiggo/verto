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
  LoaderCircle,
  MessageCirclePlus,
  Pin,
  Search,
  SquarePen,
  Tag,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ContentDirNode, ContentFileNode } from "@/lib/content-source";
import {
  useRuntimeLocalIndex,
  type RuntimeLocalIndexState,
} from "@/components/runtime/useRuntimeLocalIndex";
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
  { href: "/recent", label: "Recently updated", icon: FileText },
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

function isBuildSourceReady(source?: SourceInfo): boolean {
  if (source?.readiness?.status === "error") return false;
  return source?.kind !== "local" || source?.label.startsWith("Folder ·") === true;
}

function sourceTaskLabel(source: SourceInfo | undefined, ready: boolean): string {
  if (source?.readiness?.status === "error") return "Fix content source";
  return ready ? "Content source ready" : "Connect a content source";
}

function SetupCard({ source, onNavigate }: { source?: SourceInfo; onNavigate?: () => void }) {
  const titleId = useId();
  const buildSourceReady = isBuildSourceReady(source);
  const snapshot = useSyncExternalStore(
    subscribeSetupReadiness,
    () => setupReadinessSnapshot(buildSourceReady),
    () =>
      JSON.stringify({
        source: false,
        assistant: false,
        assistantStatus: "none",
        library: false,
        reading: false,
        onboarding: {},
      })
  );
  const readiness = parseSetupReadiness(snapshot);
  const assistantReady = readiness.assistantStatus === "ready";
  const assistantPreview = readiness.assistantStatus === "preview";
  const tasks = [
    {
      href: "/integrations",
      label: sourceTaskLabel(source, readiness.source),
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
      label: assistantReady
        ? "Assistant ready"
        : assistantPreview
          ? "Demo assistant available"
          : "Configure the agent",
      icon: assistantReady ? Check : MessageCirclePlus,
      done: assistantReady,
    },
    {
      href: "/settings/reading",
      label: readiness.reading ? "Reading preferences set" : "Tune reading preferences",
      icon: readiness.reading ? Check : BookOpen,
      done: readiness.reading,
    },
  ];
  const completedCount = tasks.filter((task) => task.done).length;

  if (completedCount === tasks.length) return null;

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

interface WorkspaceDocumentsProps {
  headingId: string;
  onNavigate?: () => void;
  pathname: string;
  root?: ContentDirNode;
  source?: SourceInfo;
  runtimeLocal: RuntimeLocalIndexState;
}

function WorkspaceDocuments({
  headingId,
  onNavigate,
  pathname,
  root,
  source,
  runtimeLocal,
}: WorkspaceDocumentsProps) {
  const documents = useMemo(() => {
    if (runtimeLocal.status === "ready") {
      return runtimeLocal.index.documents
        .map((document) => document.node)
        .filter((document) => !document.hidden && !document.draft)
        .slice(0, 5);
    }
    if (runtimeLocal.status !== "idle") return [];
    return collectDocuments(root).slice(0, 5);
  }, [root, runtimeLocal]);

  const buildSourceError = source?.readiness?.status === "error" ? source.readiness.error : null;

  return (
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
        {runtimeLocal.status === "loading" ? (
          <div
            className="vx-nav-item is-document"
            role="status"
            title={`Loading ${runtimeLocal.folder}`}
          >
            <LoaderCircle className="vx-nav-icon" aria-hidden />
            <span className="vx-nav-label">Loading local documents…</span>
          </div>
        ) : runtimeLocal.status === "error" ? (
          <Link
            href="/integrations#local-files"
            className="vx-nav-item is-document"
            onClick={onNavigate}
            title={runtimeLocal.error}
          >
            <TriangleAlert className="vx-nav-icon" aria-hidden />
            <span className="vx-nav-label">Local library unavailable</span>
          </Link>
        ) : runtimeLocal.status === "idle" && buildSourceError ? (
          <Link
            href="/integrations"
            className="vx-nav-item is-document"
            onClick={onNavigate}
            title={buildSourceError}
          >
            <TriangleAlert className="vx-nav-icon" aria-hidden />
            <span className="vx-nav-label">Content source unavailable</span>
          </Link>
        ) : documents.length === 0 ? (
          <Link href="/integrations" className="vx-nav-item is-document" onClick={onNavigate}>
            <FolderInput className="vx-nav-icon" aria-hidden />
            <span className="vx-nav-label">
              {runtimeLocal.status === "ready"
                ? "No readable documents in this folder"
                : "Connect your first source"}
            </span>
          </Link>
        ) : null}
      </nav>
    </section>
  );
}

export default function VxRail({ onNavigate, source, root }: VxRailProps) {
  const pathname = usePathname() ?? "/";
  const headingId = useId();
  const runtimeLocal = useRuntimeLocalIndex();
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

        <WorkspaceDocuments
          headingId={headingId}
          onNavigate={onNavigate}
          pathname={pathname}
          root={root}
          source={source}
          runtimeLocal={runtimeLocal}
        />
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
