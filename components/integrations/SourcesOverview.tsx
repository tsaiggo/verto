"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Cloud,
  Database,
  FolderOpen,
  Github,
  HardDrive,
  Hash,
  Layers,
  NotebookText,
  Rss,
  Upload,
  type LucideIcon,
} from "lucide-react";

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

const STATUS_LABEL: Record<SourceStatus, string> = {
  synced: "Synced",
  syncing: "Syncing",
  disconnected: "Disconnected",
};

/** Provider kind -> lucide icon, mirroring the Connect-source provider icons. */
const SOURCE_ICONS: Record<string, LucideIcon> = {
  local: FolderOpen,
  github: Github,
  onedrive: Cloud,
  rss: Rss,
  import: Upload,
  gdrive: HardDrive,
  notion: NotebookText,
  slack: Hash,
  dropbox: Box,
  confluence: Layers,
};

/**
 * Functional Sources & Integrations overview (mockup 58). Tabbed list of
 * connected sources with sync status, item counts and a per-row Details
 * affordance. Counts on the tabs are derived from the data.
 */
export default function SourcesOverview({ sources }: { sources: SourceRow[] }) {
  const [tab, setTab] = useState<TabId>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const counts = useMemo(() => {
    const connected = sources.filter((s) => s.status !== "disconnected").length;
    return {
      all: sources.length,
      connected,
      disconnected: sources.length - connected,
    };
  }, [sources]);

  const summary = useMemo(() => {
    const itemCount = sources.reduce((sum, source) => sum + source.items, 0);
    const syncing = sources.filter((source) => source.status === "syncing").length;
    return {
      connected: counts.connected,
      itemCount,
      attention: counts.disconnected + syncing,
    };
  }, [counts.connected, counts.disconnected, sources]);

  const rows = useMemo(() => {
    if (tab === "connected") return sources.filter((s) => s.status !== "disconnected");
    if (tab === "disconnected") return sources.filter((s) => s.status === "disconnected");
    return sources;
  }, [sources, tab]);

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "all", label: "All Sources", count: counts.all },
    { id: "connected", label: "Connected", count: counts.connected },
    { id: "disconnected", label: "Disconnected", count: counts.disconnected },
  ];

  return (
    <div className="v-page src">
      <div className="src-overview" aria-label="Source summary">
        <article className="src-metric">
          <span className="src-metric-label">Connected</span>
          <strong>{summary.connected}</strong>
          <small>live source{summary.connected === 1 ? "" : "s"}</small>
        </article>
        <article className="src-metric">
          <span className="src-metric-label">Indexed items</span>
          <strong>{summary.itemCount.toLocaleString()}</strong>
          <small>available to reader and agent</small>
        </article>
        <article className="src-metric">
          <span className="src-metric-label">Needs attention</span>
          <strong>{summary.attention}</strong>
          <small>disconnected or syncing providers</small>
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

      <section className="src-card">
        <div className="src-card-head">
          <h2 className="src-card-title">Sources</h2>
          <span className="src-card-note">{rows.length} shown</span>
        </div>
        <div className="src-table-head" aria-hidden>
          <span>Source</span>
          <span>Last sync</span>
          <span>Items</span>
          <span>Status</span>
          <span />
        </div>
        <ul className="src-list">
          {rows.map((source) => {
            const Icon = SOURCE_ICONS[source.kind] ?? Database;
            const open = expanded === source.kind;
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
                <span className="src-items">{source.items.toLocaleString()} items</span>
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
                  {open ? "Hide" : "Details"}
                </button>
                {open && (
                  <div className="src-detail-panel">
                    <span>
                      <strong>Status:</strong> {STATUS_LABEL[source.status]}
                    </span>
                    <span>
                      <strong>Source:</strong> {source.detail}
                    </span>
                    <span>
                      <strong>Files:</strong> {source.items.toLocaleString()}
                    </span>
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
