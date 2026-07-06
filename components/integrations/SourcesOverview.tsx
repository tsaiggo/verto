"use client";

import { useMemo, useState } from "react";

export type SourceStatus = "synced" | "syncing" | "disconnected";

export interface SourceRow {
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

/**
 * Functional Sources & Integrations overview (mockup 58). Tabbed list of
 * connected sources with sync status, item counts and a per-row Details
 * affordance. Counts on the tabs are derived from the data.
 */
export default function SourcesOverview({ sources }: { sources: SourceRow[] }) {
  const [tab, setTab] = useState<TabId>("all");

  const counts = useMemo(() => {
    const connected = sources.filter((s) => s.status !== "disconnected").length;
    return {
      all: sources.length,
      connected,
      disconnected: sources.length - connected,
    };
  }, [sources]);

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
        <h2 className="src-card-title">Sources</h2>
        <ul className="src-list">
          {rows.map((source, i) => (
            <li key={source.name} className="src-row">
              <span className="src-index">{i + 1}</span>
              <span className="src-name">
                <strong>{source.name}</strong>
                <small>{source.detail}</small>
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
              <button type="button" className="v-btn v-btn--sm src-details">
                Details
              </button>
            </li>
          ))}
          {rows.length === 0 ? <li className="src-empty">No sources in this view.</li> : null}
        </ul>
      </section>
    </div>
  );
}
