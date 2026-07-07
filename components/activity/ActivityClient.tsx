"use client";

import { useEffect, useState } from "react";

import PageHeader from "@/components/layout/PageHeader";
import { ANNOTATIONS_KEY } from "@/lib/annotations";
import {
  computeActivityStats,
  computeHeatmap,
  formatMinutes,
  type ActivityStats,
  type DateRangeFilter,
  type HeatmapDay,
} from "@/lib/activity";
import { READING_STATE_KEY } from "@/lib/reading-state";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLS = 12;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const RANGE_LABELS: Record<DateRangeFilter, string> = {
  week: "This Week",
  month: "This Month",
  all: "All",
};

const EMPTY_STATS: ActivityStats = {
  docsRead: 0,
  estimatedMinutes: 0,
  noteCount: 0,
  dateRange: { from: new Date(0), to: new Date(0) },
};

// ---------------------------------------------------------------------------
// Heatmap grid helpers
// ---------------------------------------------------------------------------

function countToLevel(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

/**
 * Builds a 7-row × COLS-col intensity grid aligned to the current week (UTC).
 * Row 0 = Monday, row 6 = Sunday.
 * Col 0 = oldest week, col COLS-1 = current week.
 * Returns column labels (month abbreviations) for the bottom axis.
 */
function buildHeatGrid(
  heatmapData: HeatmapDay[],
  now: Date
): { grid: number[][]; columnLabels: string[] } {
  const lookup = new Map(heatmapData.map((d) => [d.date, d.count]));

  // Snap to Monday of the current UTC week.
  const todayUTC = new Date(now);
  todayUTC.setUTCHours(0, 0, 0, 0);
  const dayOfWeek = (todayUTC.getUTCDay() + 6) % 7; // 0 = Mon
  const thisMonday = new Date(todayUTC);
  thisMonday.setUTCDate(todayUTC.getUTCDate() - dayOfWeek);

  // Oldest column starts (COLS-1) full weeks before thisMonday.
  const startMonday = new Date(thisMonday);
  startMonday.setUTCDate(thisMonday.getUTCDate() - (COLS - 1) * 7);

  const grid: number[][] = Array.from({ length: 7 }, () => new Array<number>(COLS).fill(0));
  const columnLabels: string[] = new Array<string>(COLS).fill("");
  let lastMonth = -1;

  for (let col = 0; col < COLS; col++) {
    const colDate = new Date(startMonday);
    colDate.setUTCDate(startMonday.getUTCDate() + col * 7);

    const month = colDate.getUTCMonth();
    if (month !== lastMonth) {
      columnLabels[col] = colDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      });
      lastMonth = month;
    }

    for (let row = 0; row < 7; row++) {
      const d = new Date(colDate);
      d.setUTCDate(colDate.getUTCDate() + row);
      const dateStr = d.toISOString().slice(0, 10);
      grid[row][col] = countToLevel(lookup.get(dateStr) ?? 0);
    }
  }

  return { grid, columnLabels };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ActivityClientProps {
  topTags: { name: string; count: number }[];
  recent: { key: string; title: string; sub: string; time: string }[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActivityClient({ topTags, recent }: ActivityClientProps) {
  const [range, setRange] = useState<DateRangeFilter>("week");
  const [stats, setStats] = useState<ActivityStats>(EMPTY_STATS);
  const [heatmapData, setHeatmapData] = useState<HeatmapDay[]>([]);

  useEffect(() => {
    function refresh() {
      setStats(computeActivityStats(range));
      setHeatmapData(computeHeatmap(range));
    }
    refresh();

    function onStorage(e: StorageEvent) {
      if (e.key === null || e.key === READING_STATE_KEY || e.key === ANNOTATIONS_KEY) {
        refresh();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [range]);

  // Heatmap grid aligned to today's UTC week.
  const { grid, columnLabels } = buildHeatGrid(heatmapData, new Date());

  function handleExport() {
    const payload = {
      stats: computeActivityStats("all"),
      heatmap: computeHeatmap("all"),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "verto-activity.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="Your knowledge rhythm over time."
        tools={
          <>
            <button type="button" className="v-btn v-btn--sm" onClick={handleExport}>
              Export
            </button>
            <div className="act-range" role="group" aria-label="Date range">
              {(["week", "month", "all"] as DateRangeFilter[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  className="v-btn v-btn--sm"
                  aria-pressed={range === r}
                  onClick={() => setRange(r)}
                >
                  {RANGE_LABELS[r]}
                </button>
              ))}
            </div>
          </>
        }
      />

      <div className="v-page act">
        <div className="act-stats">
          <div className="v-card act-stat">
            <span className="act-stat-label">Reading time</span>
            <span className="act-stat-value">{formatMinutes(stats.estimatedMinutes)}</span>
          </div>
          <div className="v-card act-stat">
            <span className="act-stat-label">Documents read</span>
            <span className="act-stat-value">{stats.docsRead}</span>
          </div>
          <div className="v-card act-stat">
            <span className="act-stat-label">Notes created</span>
            <span className="act-stat-value">{stats.noteCount}</span>
          </div>
        </div>

        <div className="act-main">
          <div className="v-card act-heatcard">
            <div className="v-cardhead">
              <span className="v-cardhead-title">Daily activity</span>
            </div>
            <div className="v-card-divider" />
            <div className="act-heat">
              <div className="act-heat-body">
                <div className="act-heat-hours" aria-hidden>
                  {WEEKDAYS.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="act-heat-grid" role="img" aria-label="Daily activity heatmap">
                  {grid.map((row, r) => (
                    <div key={r} className="act-heat-row">
                      {row.map((level, c) => (
                        <span key={c} className="act-heat-cell" data-level={level} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="act-heat-days" aria-hidden>
                {columnLabels.map((label, i) => (
                  <span key={i}>{label}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="v-card act-side">
            <div className="v-cardhead">
              <span className="v-cardhead-title">Top sources</span>
            </div>
            <div className="v-card-divider" />
            <ul className="act-rank">
              <li className="act-rank-row">
                <span className="act-rank-name">Local</span>
                <span className="act-rank-bar" aria-hidden>
                  <span style={{ width: "100%" }} />
                </span>
                <span className="act-rank-val">100%</span>
              </li>
            </ul>

            {topTags.length > 0 && (
              <>
                <div className="v-card-divider" />
                <div className="v-cardhead">
                  <span className="v-cardhead-title">Top tags</span>
                </div>
                <ul className="act-rank act-rank--tags">
                  {topTags.map((t) => (
                    <li key={t.name} className="act-rank-row">
                      <span className="act-rank-name">#{t.name}</span>
                      <span className="act-rank-val">{t.count}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        {recent.length > 0 && (
          <div className="v-card act-recent">
            <div className="v-cardhead">
              <span className="v-cardhead-title">Recent activity</span>
            </div>
            <div className="v-card-divider" />
            <ul className="act-recent-list">
              {recent.map((row) => (
                <li key={row.key} className="act-recent-row">
                  <span className="act-recent-main">
                    <strong className="act-recent-title">{row.title}</strong>
                    <small className="act-recent-sub">{row.sub}</small>
                  </span>
                  <span className="act-recent-time">{row.time}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
