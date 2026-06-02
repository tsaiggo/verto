"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Cloud,
  Github,
  HardDrive,
  Home,
  Plus,
  Puzzle,
  Search,
  Settings,
  ChevronDown,
} from "lucide-react";
import FileTree from "@/components/reader/FileTree";
import type { ContentDirNode } from "@/lib/content-source";
import type { SourceInfo, SourceKind } from "@/lib/source-info";

interface RailContentProps {
  root: ContentDirNode;
  source: SourceInfo;
  /** Total readable document count, shown as a badge on the active source. */
  fileCount: number;
}

const PRIMARY_NAV = [
  { label: "Home", href: "/", icon: Home, shortcut: undefined },
  { label: "Search", href: "/read", icon: Search, shortcut: "⌘K" },
  { label: "Bookmarks", href: "/read", icon: Bookmark, shortcut: undefined },
] as const;

const SOURCE_META: Record<
  SourceKind | "googledrive",
  { name: string; icon: typeof Github }
> = {
  github: { name: "GitHub Repo", icon: Github },
  onedrive: { name: "OneDrive", icon: Cloud },
  local: { name: "Local Files", icon: HardDrive },
  googledrive: { name: "Google Drive", icon: HardDrive },
};

// Order of source groups shown under LIBRARY, mirroring the design.
const SOURCE_ORDER: (SourceKind | "googledrive")[] = [
  "github",
  "onedrive",
  "googledrive",
];

/**
 * Inner content of the left application rail — shared by the fixed desktop
 * rail and the mobile slide-over. Renders the brand block, primary nav, the
 * LIBRARY section (active source tree + placeholder source groups), and the
 * footer (Integrations / Settings / account card).
 */
export default function RailContent({
  root,
  source,
  fileCount,
}: RailContentProps) {
  const pathname = usePathname();

  // The active source kind always renders the live file tree; if it isn't one
  // of the design's three cloud groups (e.g. `local`), prepend it so the real
  // library is always visible.
  const order: (SourceKind | "googledrive")[] = SOURCE_ORDER.includes(
    source.kind,
  )
    ? SOURCE_ORDER
    : [source.kind, ...SOURCE_ORDER];

  return (
    <div className="app-rail-inner">
      {/* Brand */}
      <Link href="/" className="app-rail-brand" aria-label="Verto home">
        <span className="app-rail-logo" aria-hidden>
          <svg viewBox="0 0 24 24" width={16} height={16}>
            <path d="M4 4l8 16 8-16H4z" fill="currentColor" />
          </svg>
        </span>
        <span className="app-rail-brand-text">
          <span className="app-rail-brand-name">Verto</span>
          <span className="app-rail-brand-tagline">A beautiful MDX reader.</span>
        </span>
      </Link>

      {/* Primary nav */}
      <nav className="app-rail-nav" aria-label="Primary">
        {PRIMARY_NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`app-rail-link${active ? " is-active" : ""}`}
            >
              <Icon className="app-rail-link-icon" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {item.shortcut && (
                <kbd className="app-rail-kbd">{item.shortcut}</kbd>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Library */}
      <div className="app-rail-section">
        <div className="app-rail-section-head">
          <span className="app-rail-section-title">Library</span>
          <button type="button" className="app-rail-addsource">
            <Plus className="app-rail-addsource-icon" aria-hidden />
            Add source
          </button>
        </div>

        <div className="app-rail-sources">
          {order.map((kind) => {
            const meta = SOURCE_META[kind];
            const isActive = kind === source.kind;
            const Icon = meta.icon;
            return (
              <details
                key={kind}
                className="app-rail-source"
                open={isActive}
              >
                <summary className="app-rail-source-head">
                  <ChevronDown className="app-rail-source-chevron" aria-hidden />
                  <Icon className="app-rail-source-icon" aria-hidden />
                  <span className="flex-1">{meta.name}</span>
                  {isActive ? (
                    <span className="app-rail-source-count">{fileCount}</span>
                  ) : (
                    <span className="app-rail-source-muted">—</span>
                  )}
                </summary>
                {isActive ? (
                  <div className="app-rail-source-tree">
                    <FileTree root={root} pathname={pathname} />
                  </div>
                ) : (
                  <div className="app-rail-source-empty">Not connected</div>
                )}
              </details>
            );
          })}
        </div>
      </div>

      <div className="flex-1" />

      {/* Footer actions */}
      <nav className="app-rail-footer-nav" aria-label="Secondary">
        <button type="button" className="app-rail-link">
          <Puzzle className="app-rail-link-icon" aria-hidden />
          <span className="flex-1">Integrations</span>
        </button>
        <button type="button" className="app-rail-link">
          <Settings className="app-rail-link-icon" aria-hidden />
          <span className="flex-1">Settings</span>
        </button>
      </nav>

      {/* Account card */}
      <button type="button" className="app-rail-account">
        <span className="app-rail-account-avatar" aria-hidden>
          V
        </span>
        <span className="app-rail-account-text">
          <span className="app-rail-account-name">Verto Team</span>
          <span className="app-rail-account-plan">Pro Plan</span>
        </span>
        <ChevronDown className="app-rail-account-chevron" aria-hidden />
      </button>
    </div>
  );
}
