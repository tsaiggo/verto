import { loadAnnotations } from "@/lib/annotations";
import { loadReadingState } from "@/lib/reading-state";

export interface ActivityStats {
  docsRead: number;
  estimatedMinutes: number;
  noteCount: number;
  dateRange: { from: Date; to: Date };
}

export interface HeatmapDay {
  date: string; // "YYYY-MM-DD"
  count: number; // reading events that day
}

export type DateRangeFilter = "week" | "month" | "all";

/** Returns the [from, to] Date window for a given range, relative to `now`. Uses UTC throughout so that comparisons with ISO-string timestamps are timezone-agnostic. */
export function dateRangeWindow(
  range: DateRangeFilter,
  now: Date = new Date()
): { from: Date; to: Date } {
  const to = new Date(now);
  to.setUTCHours(23, 59, 59, 999);

  if (range === "all") {
    return { from: new Date(0), to };
  }

  const from = new Date(now);
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - (range === "week" ? 6 : 29));
  return { from, to };
}

/** Format a minute count as "Xm", "Xh", or "Xh Ym". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Derive activity stats for the given date range.
 *
 * - `docsRead`: unique reading entries whose `lastReadAt` falls in the window
 * - `estimatedMinutes`: 5 min per reading event (simple heuristic)
 * - `noteCount`: annotations whose `createdAt` falls in the window
 */
export function computeActivityStats(
  range: DateRangeFilter,
  now: Date = new Date()
): ActivityStats {
  const { from, to } = dateRangeWindow(range, now);
  const { recent } = loadReadingState();
  const { annotations } = loadAnnotations();

  const docsRead = recent.filter((entry) => {
    const ts = Date.parse(entry.lastReadAt);
    return Number.isFinite(ts) && ts >= from.getTime() && ts <= to.getTime();
  }).length;

  const noteCount = annotations.filter((a) => {
    const ts = Date.parse(a.createdAt);
    return Number.isFinite(ts) && ts >= from.getTime() && ts <= to.getTime();
  }).length;

  return {
    docsRead,
    estimatedMinutes: docsRead * 5,
    noteCount,
    dateRange: { from, to },
  };
}

/**
 * Build a per-day reading-event count for the given range.
 * Returns an array sorted by date ascending.
 */
export function computeHeatmap(range: DateRangeFilter, now: Date = new Date()): HeatmapDay[] {
  const { from } = dateRangeWindow(range, now);
  const { recent } = loadReadingState();

  const counts = new Map<string, number>();
  for (const entry of recent) {
    const ts = Date.parse(entry.lastReadAt);
    if (!Number.isFinite(ts) || ts < from.getTime()) continue;
    const day = new Date(ts).toISOString().slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
