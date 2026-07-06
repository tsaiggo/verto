// Pure formatting helpers for the Search view: query highlighting + relative time.
import type { ReactNode } from "react";

/** Split `text` around case-insensitive matches of any query term. */
export function highlight(text: string, query: string): ReactNode {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return text;
  const lower = text.toLowerCase();

  // Collect non-overlapping match ranges for all terms, left to right.
  const ranges: [number, number][] = [];
  for (const term of terms) {
    let from = 0;
    let idx = lower.indexOf(term, from);
    while (idx !== -1) {
      ranges.push([idx, idx + term.length]);
      from = idx + term.length;
      idx = lower.indexOf(term, from);
    }
  }
  if (ranges.length === 0) return text;
  ranges.sort((a, b) => a[0] - b[0]);

  const out: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  for (const [start, end] of ranges) {
    if (start < cursor) continue; // skip overlaps
    if (start > cursor) out.push(text.slice(cursor, start));
    out.push(
      <mark key={key++} className="search-hit">
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

/** Compact relative time ("10m ago", "Yesterday", "3d ago"). */
export function relativeTime(ms: number, now: number): string {
  if (!ms) return "";
  const diff = now - ms;
  if (diff < 60_000) return "just now";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 30) return `${day}d ago`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon}mo ago`;
  return `${Math.floor(mon / 12)}y ago`;
}
