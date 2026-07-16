import type { ContentFileNode } from "@/lib/content-source";
import { formatDate } from "@/lib/format";

export interface RecentDocumentDate {
  /** Safe machine-readable value for a <time> element, or null when unknown. */
  iso: string | null;
  /** Recent always describes the same updated-at concept, regardless of source. */
  label: string;
  /** Sort key. Unknown dates intentionally sort behind every known date. */
  timestamp: number;
}

function parseDateOnly(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? timestamp
    : null;
}

function parseDate(value: string | undefined): number | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const dateOnly = parseDateOnly(trimmed);
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return dateOnly;
  const timestamp = Date.parse(trimmed);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function resolvedDate(file: ContentFileNode): { value: string | null; timestamp: number } {
  for (const candidate of [file.updated, file.date]) {
    const timestamp = parseDate(candidate);
    if (timestamp !== null && candidate) return { value: candidate.trim(), timestamp };
  }
  const mtime = new Date(file.mtime);
  if (file.mtime > 0 && Number.isFinite(mtime.getTime())) {
    return { value: mtime.toISOString(), timestamp: file.mtime };
  }
  return { value: null, timestamp: 0 };
}

/**
 * Resolve one truthful, safe "updated" value for Recent.
 *
 * Invalid frontmatter falls through to mtime instead of reaching
 * `toISOString()` and throwing. A source with no valid date renders an honest
 * unavailable label rather than `Invalid Date` or the Unix epoch.
 */
export function recentDocumentDate(file: ContentFileNode): RecentDocumentDate {
  const resolved = resolvedDate(file);
  if (!resolved.value) {
    return { iso: null, label: "Update date unavailable", timestamp: 0 };
  }
  return {
    iso: new Date(resolved.timestamp).toISOString(),
    label: `Updated ${formatDate(resolved.value)}`,
    timestamp: resolved.timestamp,
  };
}

export function sortRecentDocuments(files: ContentFileNode[], limit = 12): ContentFileNode[] {
  return files
    .filter((file) => !file.hidden && !file.draft)
    .map((file) => ({ file, timestamp: resolvedDate(file).timestamp }))
    .toSorted((a, b) => b.timestamp - a.timestamp)
    .slice(0, Math.max(0, limit))
    .map(({ file }) => file);
}
