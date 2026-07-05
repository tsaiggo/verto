"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Cloud,
  Github,
  HardDrive,
  Inbox,
  Plus,
  Puzzle,
  Search,
  ChevronDown,
} from "lucide-react";
import FileTree from "@/components/reader/FileTree";
import RailAccount from "@/components/layout/RailAccount";
import { useAuth } from "@/components/auth/AuthProvider";
import { createRuntimeSource } from "@/lib/content-source/runtime-source";
import { buildRuntimeContentTree } from "@/lib/content-source/runtime-tree";
import { buildLibrarySourceViews, type LibrarySourceView } from "@/lib/library-rail";
import { LOCAL_FOLDER_CHANGED_EVENT, loadActiveLocalFolder } from "@/lib/local-folder";
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

type RailSourceView = LibrarySourceView<ContentDirNode>;

const SOURCE_META: Record<SourceKind | "googledrive", { name: string; icon: typeof Github }> = {
  github: { name: "GitHub Repo", icon: Github },
  onedrive: { name: "OneDrive", icon: Cloud },
  local: { name: "Local Files", icon: HardDrive },
  googledrive: { name: "Google Drive", icon: HardDrive },
};

/**
 * Inner content of the left application rail — shared by the fixed desktop
 * rail and the mobile slide-over. Renders the brand block (doubles as the
 * Home link), an Obsidian-style Explorer (filter + source file-trees), a sync
 * status line, and a compact footer (Inbox / Help / Integrations + account).
 */
export default function RailContent({ root, source, fileCount }: RailContentProps) {
  const pathname = usePathname();
  const auth = useAuth();
  const [query, setQuery] = useState("");

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

  const totalNotes = sourceViews
    .filter((v) => v.isConnected)
    .reduce((sum, v) => sum + v.fileCount, 0);

  // Split the sources: connected (or mid-connect) ones render as file trees;
  // never-connected ones collapse into quiet "Connect" rows so the Explorer
  // isn't padded out with dead, non-expandable placeholders.
  const activeSources = sourceViews.filter(
    (v) => v.isConnected || v.status === "loading" || v.status === "error"
  );
  const disconnectedSources = sourceViews.filter((v) => !v.isConnected && v.status === "idle");

  const footClass = (href: string) =>
    `rail-explorer-footbtn${
      pathname === href || pathname.startsWith(href + "/") ? " is-active" : ""
    }`;

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
          <span className="app-rail-brand-tagline">A calm knowledge reader.</span>
        </span>
      </Link>

      {/* Explorer head */}
      <div className="rail-explorer-head">
        <span className="rail-explorer-title">Explorer</span>
        <Link
          href="/integrations"
          className="rail-explorer-action"
          title="Add source"
          aria-label="Add source"
        >
          <Plus className="rail-explorer-action-icon" aria-hidden />
        </Link>
      </div>

      {/* Filter files */}
      <div className="rail-filter">
        <Search className="rail-filter-icon" aria-hidden />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter files"
          className="rail-filter-input"
          aria-label="Filter files"
          spellCheck={false}
        />
      </div>

      {/* Explorer trees */}
      <ExplorerSources
        activeSources={activeSources}
        disconnectedSources={disconnectedSources}
        pathname={pathname}
        query={query}
        runtimeSource={runtimeSource}
      />

      <div className="flex-1" />

      {/* Sync status — Obsidian-style vault footer. */}
      <div className="rail-explorer-status">
        <span className="rail-explorer-dot" aria-hidden />
        Synced · {totalNotes} {totalNotes === 1 ? "note" : "notes"}
      </div>

      {/* Secondary actions — folded into a compact icon row now the nav is an Explorer. */}
      <nav className="rail-explorer-foot" aria-label="Secondary">
        <Link href="/inbox" className={footClass("/inbox")} title="Inbox" aria-label="Inbox">
          <Inbox className="rail-explorer-foot-icon" aria-hidden />
        </Link>
        <Link href="/help" className={footClass("/help")} title="Help" aria-label="Help">
          <BookOpen className="rail-explorer-foot-icon" aria-hidden />
        </Link>
        <Link
          href="/integrations"
          className={footClass("/integrations")}
          title="Integrations"
          aria-label="Integrations"
        >
          <Puzzle className="rail-explorer-foot-icon" aria-hidden />
        </Link>
      </nav>

      {/* Account card — GitHub identity the desktop app is built around. */}
      <RailAccount />
    </div>
  );
}

function ExplorerSources({
  activeSources,
  disconnectedSources,
  pathname,
  query,
  runtimeSource,
}: {
  activeSources: RailSourceView[];
  disconnectedSources: RailSourceView[];
  pathname: string;
  query: string;
  runtimeSource: SourceInfo | null;
}) {
  return (
    <div className="app-rail-section rail-explorer-section">
      <div className="app-rail-sources">
        {activeSources.map((view) => {
          const meta = SOURCE_META[view.kind];
          const Icon = meta.icon;
          return (
            <details key={view.kind} className="app-rail-source" open={view.open}>
              <summary className="app-rail-source-head">
                <ChevronDown className="app-rail-source-chevron" aria-hidden />
                <Icon className="app-rail-source-icon" aria-hidden />
                <span className="app-rail-source-name">
                  {view.kind === "github" && runtimeSource ? runtimeSource.label : meta.name}
                </span>
                {view.isConnected ? (
                  <span className="app-rail-source-count">{view.fileCount}</span>
                ) : null}
              </summary>
              {view.status === "loading" ? (
                <div className="app-rail-source-empty">Loading files…</div>
              ) : view.status === "error" ? (
                <div className="app-rail-source-empty">Could not load files: {view.error}</div>
              ) : view.isConnected && view.root ? (
                <div className="app-rail-source-tree">
                  {view.root.children.length > 0 ? (
                    <FileTree root={view.root} pathname={pathname} query={query} />
                  ) : (
                    <div className="app-rail-source-empty">No files found</div>
                  )}
                </div>
              ) : null}
            </details>
          );
        })}
      </div>

      {disconnectedSources.length > 0 ? (
        <div className="app-rail-connects">
          {disconnectedSources.map((view) => {
            const meta = SOURCE_META[view.kind];
            const Icon = meta.icon;
            return (
              <Link key={view.kind} href="/integrations" className="app-rail-connect">
                <Icon className="app-rail-connect-icon" aria-hidden />
                <span className="app-rail-connect-name">{meta.name}</span>
                <span className="app-rail-connect-cta" aria-hidden>
                  Connect
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}
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
        const source = createRuntimeSource({
          kind: "github",
          connection: { ...activeConnection, token: accessToken },
          fetchImpl,
        });
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
