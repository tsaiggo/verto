"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Database, FolderOpen, Rss, type LucideIcon } from "lucide-react";
import LocalConnectPanel from "@/components/integrations/LocalConnectPanel";
import { LOCAL_FOLDER_CHANGED_EVENT, loadActiveLocalFolder } from "@/lib/local-folder";
import { isTauri, listLocalFolder } from "@/lib/tauri";
import RssSourceDetail, {
  formatRssSync,
  useSubscriptions,
} from "@/components/integrations/RssSourceDetail";
import type { RawFileEntry } from "@/lib/content-source";
import type { Subscription } from "@/lib/subscriptions";

export type SourceStatus = "synced" | "syncing" | "disconnected";

export interface SourceRow {
  kind: string;
  name: string;
  detail: string;
  lastSync: string;
  items: number;
  status: SourceStatus;
  progress?: number;
}

type TabId = "all" | "connected" | "disconnected";
type RuntimeLocalStatus = "idle" | "loading" | "ready" | "error";

interface RuntimeLocalSource {
  status: RuntimeLocalStatus;
  folder: string | null;
  fileCount: number | null;
  folderCount: number | null;
  samplePaths: string[];
  error: string | null;
}

const STATUS_LABEL: Record<SourceStatus, string> = {
  synced: "Synced",
  syncing: "Syncing",
  disconnected: "Not set up",
};

const SOURCE_ICONS: Record<string, LucideIcon> = {
  local: FolderOpen,
  rss: Rss,
};

const EMPTY_RUNTIME_LOCAL: RuntimeLocalSource = {
  status: "idle",
  folder: null,
  fileCount: null,
  folderCount: null,
  samplePaths: [],
  error: null,
};

function countFolders(entries: RawFileEntry[]): number {
  const folders = new Set<string>();
  for (const entry of entries) {
    for (let depth = 1; depth < entry.path.length; depth += 1) {
      folders.add(entry.path.slice(0, depth).join("/"));
    }
  }
  return folders.size;
}

function samplePaths(entries: RawFileEntry[]): string[] {
  return entries.slice(0, 5).map((entry) => entry.path.join("/"));
}

function useRuntimeLocalSource(): RuntimeLocalSource {
  const [folder, setFolder] = useState<string | null>(null);
  const [result, setResult] = useState<RuntimeLocalSource | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    const refresh = () => setFolder(loadActiveLocalFolder());
    refresh();
    window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LOCAL_FOLDER_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (!folder || !isTauri()) return;

    let cancelled = false;
    const activeFolder = folder;

    async function load() {
      try {
        const entries = await listLocalFolder(activeFolder);
        if (cancelled) return;
        setResult({
          status: "ready",
          folder: activeFolder,
          fileCount: entries.length,
          folderCount: countFolders(entries),
          samplePaths: samplePaths(entries),
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setResult({
          status: "error",
          folder: activeFolder,
          fileCount: 0,
          folderCount: 0,
          samplePaths: [],
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [folder]);

  if (!folder) return EMPTY_RUNTIME_LOCAL;
  if (!result || result.folder !== folder) {
    return {
      status: "loading",
      folder,
      fileCount: null,
      folderCount: null,
      samplePaths: [],
      error: null,
    };
  }
  return result;
}

function runtimeStatusLabel(runtimeLocal: RuntimeLocalSource): string {
  if (runtimeLocal.status === "loading") return "Checking...";
  if (runtimeLocal.status === "error") return "Needs attention";
  if (runtimeLocal.status === "ready") return "Just now";
  return "-";
}

function sourceCountLabel(source: SourceRow): string {
  const unit = source.kind === "rss" ? "feed" : "item";
  return `${source.items.toLocaleString()} ${unit}${source.items === 1 ? "" : "s"}`;
}

function sourcesWithRuntimeState(
  sources: SourceRow[],
  runtimeLocal: RuntimeLocalSource,
  subscriptions: readonly Subscription[]
): SourceRow[] {
  const folder = runtimeLocal.folder;
  return sources.map((source) => {
    if (source.kind === "rss") {
      const feedCount = subscriptions.length;
      return {
        ...source,
        detail:
          feedCount > 0
            ? `${feedCount.toLocaleString()} RSS/Atom feed${feedCount === 1 ? "" : "s"} in Inbox`
            : "No feeds subscribed",
        lastSync: formatRssSync(subscriptions),
        items: feedCount,
        status: feedCount > 0 ? "synced" : "disconnected",
      };
    }

    if (source.kind !== "local" || runtimeLocal.status === "idle" || !folder) return source;
    return {
      ...source,
      detail: folder,
      lastSync: runtimeStatusLabel(runtimeLocal),
      items: runtimeLocal.fileCount ?? source.items,
      status:
        runtimeLocal.status === "loading"
          ? "syncing"
          : runtimeLocal.status === "error"
            ? "disconnected"
            : "synced",
    };
  });
}

function localInitialFolder(sources: SourceRow[]): string {
  const local = sources.find((source) => source.kind === "local");
  if (!local || local.status === "disconnected") return "";
  return local.detail === "Choose a local folder" ? "" : local.detail;
}

function GenericSourceDetail({ source }: { source: SourceRow }) {
  return (
    <div className="src-detail-grid">
      <span>
        <strong>Status</strong>
        {STATUS_LABEL[source.status]}
      </span>
      <span>
        <strong>Source</strong>
        {source.detail}
      </span>
      <span>
        <strong>Count</strong>
        {sourceCountLabel(source)}
      </span>
    </div>
  );
}

function LocalSourceDetail({
  source,
  runtimeLocal,
  folder,
  setFolder,
}: {
  source: SourceRow;
  runtimeLocal: RuntimeLocalSource;
  folder: string;
  setFolder: (folder: string) => void;
}) {
  const folderLabel = (runtimeLocal.folder ?? folder) || source.detail;
  return (
    <div className="src-local-detail">
      <div className="src-local-summary">
        <div className="src-detail-grid">
          <span>
            <strong>Folder</strong>
            <code>{folderLabel || "No folder selected"}</code>
          </span>
          <span>
            <strong>Files</strong>
            {source.items.toLocaleString()}
          </span>
          <span>
            <strong>Subfolders</strong>
            {runtimeLocal.folderCount == null ? "-" : runtimeLocal.folderCount.toLocaleString()}
          </span>
        </div>
        {runtimeLocal.status === "error" && runtimeLocal.error ? (
          <p className="src-local-error">{runtimeLocal.error}</p>
        ) : null}
        {runtimeLocal.samplePaths.length > 0 ? (
          <div className="src-local-samples">
            <strong>Preview</strong>
            <ul>
              {runtimeLocal.samplePaths.map((sample) => (
                <li key={sample}>{sample}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="src-local-actions">
          <Link href="/library" className="v-btn v-btn--sm">
            Open Library
          </Link>
        </div>
      </div>
      <div className="src-local-manager">
        <LocalConnectPanel folder={folder} onFolderChange={setFolder} />
      </div>
    </div>
  );
}

export default function SourcesOverview({ sources }: { sources: SourceRow[] }) {
  const runtimeLocal = useRuntimeLocalSource();
  const subscriptions = useSubscriptions();
  const [tab, setTab] = useState<TabId>("all");
  const [expanded, setExpanded] = useState<string | null>("local");
  const initialLocalFolder = useMemo(() => localInitialFolder(sources), [sources]);
  const [localFolderOverride, setLocalFolderOverride] = useState<string | null>(null);
  const localFolder = localFolderOverride ?? runtimeLocal.folder ?? initialLocalFolder;

  const activeSources = useMemo(
    () => sourcesWithRuntimeState(sources, runtimeLocal, subscriptions),
    [runtimeLocal, sources, subscriptions]
  );

  const counts = useMemo(() => {
    const connected = activeSources.filter((s) => s.status !== "disconnected").length;
    return {
      all: activeSources.length,
      connected,
      disconnected: activeSources.length - connected,
    };
  }, [activeSources]);

  const summary = useMemo(() => {
    const local = activeSources.find((source) => source.kind === "local");
    const rss = activeSources.find((source) => source.kind === "rss");
    return {
      supported: activeSources.length,
      localFiles: local?.items ?? 0,
      rssFeeds: rss?.items ?? 0,
    };
  }, [activeSources]);

  const rows = useMemo(() => {
    if (tab === "connected") return activeSources.filter((s) => s.status !== "disconnected");
    if (tab === "disconnected") return activeSources.filter((s) => s.status === "disconnected");
    return activeSources;
  }, [activeSources, tab]);

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "all", label: "All Sources", count: counts.all },
    { id: "connected", label: "Connected", count: counts.connected },
    { id: "disconnected", label: "Not set up", count: counts.disconnected },
  ];

  return (
    <div className="v-page src">
      <div className="src-overview" aria-label="Source summary">
        <article className="src-metric">
          <span className="src-metric-label">Supported</span>
          <strong>{summary.supported}</strong>
          <small>Local Files and RSS</small>
        </article>
        <article className="src-metric">
          <span className="src-metric-label">Library files</span>
          <strong>{summary.localFiles.toLocaleString()}</strong>
          <small>Markdown / MDX documents</small>
        </article>
        <article className="src-metric">
          <span className="src-metric-label">RSS feeds</span>
          <strong>{summary.rssFeeds.toLocaleString()}</strong>
          <small>Inbox subscriptions</small>
        </article>
      </div>

      <div className="v-tabs src-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`v-tab${t.id === tab ? " is-active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className="src-tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      <section className="src-card" id="local-files">
        <div className="src-card-head">
          <h2 className="src-card-title">Sources</h2>
          <span className="src-card-note">{rows.length} shown</span>
        </div>
        <div className="src-table-head" aria-hidden>
          <span>Source</span>
          <span>Last sync</span>
          <span>Count</span>
          <span>Status</span>
          <span />
        </div>
        <ul className="src-list">
          {rows.map((source) => {
            const Icon = SOURCE_ICONS[source.kind] ?? Database;
            const open = expanded === source.kind;
            const isLocal = source.kind === "local";
            const isRss = source.kind === "rss";
            return (
              <li key={source.name} className={`src-row src-row--${source.status}`}>
                <span className={`src-icon src-icon--${source.status}`} aria-hidden>
                  <Icon />
                </span>
                <span className="src-name">
                  <strong>{source.name}</strong>
                  <small>
                    <span className="src-kind">{source.kind}</span>
                    {source.detail}
                  </small>
                </span>
                <span className="src-sync">
                  <span className="src-col-label">Last sync</span>
                  {source.lastSync}
                </span>
                <span className="src-items">{sourceCountLabel(source)}</span>
                <span className={`src-status src-status--${source.status}`}>
                  <span className="src-dot" aria-hidden />
                  {source.status === "syncing" && source.progress != null
                    ? `Syncing ${source.progress}%`
                    : STATUS_LABEL[source.status]}
                </span>
                <button
                  type="button"
                  className="v-btn v-btn--sm src-details"
                  aria-expanded={open}
                  onClick={() => setExpanded(open ? null : source.kind)}
                >
                  {open ? "Hide" : isLocal || isRss ? "Manage" : "Details"}
                </button>
                {open && (
                  <div className="src-detail-panel">
                    {isLocal ? (
                      <LocalSourceDetail
                        source={source}
                        runtimeLocal={runtimeLocal}
                        folder={localFolder}
                        setFolder={setLocalFolderOverride}
                      />
                    ) : isRss ? (
                      <RssSourceDetail subscriptions={subscriptions} />
                    ) : (
                      <GenericSourceDetail source={source} />
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {rows.length === 0 ? <li className="src-empty">No sources in this view.</li> : null}
        </ul>
      </section>
    </div>
  );
}
