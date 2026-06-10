"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Cloud,
  Github,
  HardDrive,
  Home,
  Inbox,
  Plus,
  Puzzle,
  Search,
  ChevronDown,
} from "lucide-react";
import FileTree from "@/components/reader/FileTree";
import RailAccount from "@/components/layout/RailAccount";
import { useAuth } from "@/components/auth/AuthProvider";
import { createGitHubSourceFromConnection } from "@/lib/content-source/github";
import { buildRuntimeContentTree } from "@/lib/content-source/runtime-tree";
import { buildLibrarySourceViews } from "@/lib/library-rail";
import {
  LOCAL_FOLDER_CHANGED_EVENT,
  loadActiveLocalFolder,
} from "@/lib/local-folder";
import { isTauri, listLocalFolder, tauriFetch } from "@/lib/tauri";
import type { ContentDirNode, RawFileEntry } from "@/lib/content-source";
import type { SourceInfo, SourceKind } from "@/lib/source-info";

interface RailContentProps {
  root: ContentDirNode;
  source: SourceInfo;
  /** Total readable document count, shown as a badge on the active source. */
  fileCount: number;
}

type RuntimeTreeState =
  | { status: "idle"; root: null; fileCount: 0; error: null }
  | { status: "loading"; root: null; fileCount: 0; error: null }
  | { status: "ready"; root: ContentDirNode; fileCount: number; error: null }
  | { status: "error"; root: null; fileCount: 0; error: string };

type RuntimeTreeResult = Exclude<RuntimeTreeState, { status: "idle" }> & {
  key: string;
};

const RUNTIME_TREE_IDLE: RuntimeTreeState = {
  status: "idle",
  root: null,
  fileCount: 0,
  error: null,
};

const RUNTIME_TREE_LOADING: RuntimeTreeState = {
  status: "loading",
  root: null,
  fileCount: 0,
  error: null,
};

const PRIMARY_NAV = [
  { label: "Home", href: "/", icon: Home, shortcut: undefined },
  { label: "Inbox", href: "/inbox", icon: Inbox, shortcut: undefined },
  { label: "Search", href: "/search", icon: Search, shortcut: "⌘K" },
  { label: "Library", href: "/read", icon: HardDrive, shortcut: undefined },
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

/**
 * Inner content of the left application rail — shared by the fixed desktop
 * rail and the mobile slide-over. Renders the brand block, primary nav, the
 * LIBRARY section (active source tree + placeholder source groups), and the
 * footer (Integrations / account card).
 */
export default function RailContent({
  root,
  source,
  fileCount,
}: RailContentProps) {
  const pathname = usePathname();
  const auth = useAuth();

  const runtimeTree = useRuntimeGitHubTree({
    token: auth.token,
    connection: auth.connection,
  });
  const runtimeLocalTree = useRuntimeLocalTree();
  const runtimeSource = useMemo<SourceInfo | null>(() => {
    if (!auth.connection) return null;
    return {
      kind: "github",
      name: "GitHub Repo",
      label: `${auth.connection.repo}@${auth.connection.branch}`,
      repo: auth.connection.repo,
      branch: auth.connection.branch,
      url: `https://github.com/${auth.connection.repo}/tree/${auth.connection.branch}${auth.connection.path ? "/" + auth.connection.path : ""}`,
    };
  }, [auth.connection]);

  const sourceViews = buildLibrarySourceViews({
    staticKind: source.kind,
    staticRoot: root,
    staticFileCount: fileCount,
    runtimeGitHub: runtimeTree,
    runtimeLocal: runtimeLocalTree,
  });

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
          <Link href="/integrations" className="app-rail-addsource">
            <Plus className="app-rail-addsource-icon" aria-hidden />
            Add source
          </Link>
        </div>

        <div className="app-rail-sources">
          {sourceViews.map((view) => {
            const meta = SOURCE_META[view.kind];
            const Icon = meta.icon;
            return (
              <details
                key={view.kind}
                className="app-rail-source"
                open={view.open}
              >
                <summary className="app-rail-source-head">
                  <ChevronDown className="app-rail-source-chevron" aria-hidden />
                  <Icon className="app-rail-source-icon" aria-hidden />
                  <span className="flex-1">
                    {view.kind === "github" && runtimeSource
                      ? runtimeSource.label
                      : meta.name}
                  </span>
                  {view.isConnected ? (
                    <span className="app-rail-source-count">{view.fileCount}</span>
                  ) : (
                    <span className="app-rail-source-muted">—</span>
                  )}
                </summary>
                {view.status === "loading" ? (
                  <div className="app-rail-source-empty">Loading files…</div>
                ) : view.status === "error" ? (
                  <div className="app-rail-source-empty">
                    Could not load files: {view.error}
                  </div>
                ) : view.isConnected && view.root ? (
                  <div className="app-rail-source-tree">
                    {view.root.children.length > 0 ? (
                      <FileTree root={view.root} pathname={pathname} />
                    ) : (
                      <div className="app-rail-source-empty">No files found</div>
                    )}
                  </div>
                ) : (
                  <div className="app-rail-source-empty">
                    {view.kind === "googledrive" ? "Coming soon" : "Not connected"}
                  </div>
                )}
              </details>
            );
          })}
        </div>
      </div>

      <div className="flex-1" />

      {/* Footer actions */}
      <nav className="app-rail-footer-nav" aria-label="Secondary">
        <Link
          href="/integrations"
          className={`app-rail-link${
            pathname === "/integrations" ||
            pathname.startsWith("/integrations/")
              ? " is-active"
              : ""
          }`}
        >
          <Puzzle className="app-rail-link-icon" aria-hidden />
          <span className="flex-1">Integrations</span>
        </Link>
      </nav>

      {/* Account card — GitHub identity the desktop app is built around. */}
      <RailAccount />
    </div>
  );
}

function useActiveLocalFolder(): string | null {
  const [folder, setFolder] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    const refresh = () => {
      if (!cancelled) setFolder(loadActiveLocalFolder());
    };
    queueMicrotask(refresh);
    window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(LOCAL_FOLDER_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return isTauri() ? folder : null;
}

function useRuntimeLocalTree(): RuntimeTreeState {
  const folder = useActiveLocalFolder();
  const [state, setState] = useState<RuntimeTreeResult | null>(null);

  useEffect(() => {
    if (!folder) return;

    let cancelled = false;
    const activeFolder = folder;

    async function load() {
      try {
        const entries: RawFileEntry[] = await listLocalFolder(activeFolder);
        const runtimeRoot = buildRuntimeContentTree(entries, { source: "local" });
        if (!cancelled) {
          setState({
            key: activeFolder,
            status: "ready",
            root: runtimeRoot,
            fileCount: entries.length,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            key: activeFolder,
            status: "error",
            root: null,
            fileCount: 0,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [folder]);

  if (!folder) return RUNTIME_TREE_IDLE;
  if (!state || state.key !== folder) return RUNTIME_TREE_LOADING;
  return state;
}

function useRuntimeGitHubTree({
  token,
  connection,
}: Pick<ReturnType<typeof useAuth>, "token" | "connection">): RuntimeTreeState {
  const [state, setState] = useState<RuntimeTreeResult | null>(null);
  const key = connection
    ? `${connection.repo}\n${connection.branch}\n${connection.path}\n${token ?? ""}`
    : null;

  useEffect(() => {
    if (!token || !connection || !key) return;

    let cancelled = false;
    const accessToken = token;
    const activeConnection = connection;
    const activeKey = key;

    async function load() {
      try {
        const fetchImpl = await tauriFetch();
        const source = createGitHubSourceFromConnection(
          { ...activeConnection, token: accessToken },
          { fetchImpl },
        );
        const entries: RawFileEntry[] = await source.listFiles();
        const runtimeRoot = buildRuntimeContentTree(entries, { source: "github" });
        if (!cancelled) {
          setState({
            key: activeKey,
            status: "ready",
            root: runtimeRoot,
            fileCount: entries.length,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            key: activeKey,
            status: "error",
            root: null,
            fileCount: 0,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [token, connection, key]);

  if (!token || !connection || !key) return RUNTIME_TREE_IDLE;
  if (!state || state.key !== key) return RUNTIME_TREE_LOADING;
  return state;
}
