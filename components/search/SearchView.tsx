"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  Cloud,
  Code2,
  Eye,
  FileText,
  Folder,
  Github,
  HardDrive,
  Hash,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import {
  searchRecords,
  type SearchCounts,
  type SearchRecord,
  type SearchSort,
  type SearchScope,
} from "@/lib/search";
import type { SourceKind } from "@/lib/source-info";

interface SearchViewProps {
  records: SearchRecord[];
  counts: SearchCounts;
  tags: string[];
  sourceKind: SourceKind;
  sourceName: string;
  sourceLabel: string;
}

type LastUpdated = "any" | "today" | "week" | "month";

const SCOPES: { value: SearchScope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "page", label: "Pages" },
  { value: "heading", label: "Headings" },
  { value: "code", label: "Code" },
  { value: "folder", label: "Folders" },
];

const KIND_ICON = {
  page: FileText,
  heading: Hash,
  code: Code2,
  folder: Folder,
} as const;

const SOURCE_ICON: Record<SourceKind | "googledrive" | "help", typeof Github> = {
  github: Github,
  onedrive: Cloud,
  local: HardDrive,
  googledrive: HardDrive,
  help: BookOpen,
};

// The source groups shown in the design. The active Library source and the
// always-bundled Help docs are connected; the rest render as disabled
// placeholders so the panel reflects reality without pretending data exists
// behind them.
const DESIGN_SOURCES: {
  kind: SourceKind | "googledrive" | "help";
  label: string;
  comingSoon?: boolean;
}[] = [
  { kind: "local", label: "Local Files" },
  { kind: "help", label: "Help" },
  { kind: "github", label: "GitHub Repos" },
  { kind: "onedrive", label: "OneDrive" },
  { kind: "googledrive", label: "Google Drive", comingSoon: true },
];

const WINDOW_MS: Record<Exclude<LastUpdated, "any">, number> = {
  today: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

/** Split `text` around case-insensitive matches of any query term. */
function highlight(text: string, query: string): ReactNode {
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
function relativeTime(ms: number, now: number): string {
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

export default function SearchView({
  records,
  counts,
  tags,
  sourceKind,
  sourceName,
  sourceLabel,
}: SearchViewProps) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("all");
  const [sortBy, setSortBy] = useState<SearchSort>("relevance");
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    () => new Set<string>([sourceKind, "help"])
  );
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<LastUpdated>("any");
  const [now, setNow] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isConnectedSource = (kind: SourceKind | "googledrive" | "help") =>
    kind === sourceKind || kind === "help";

  // Relative times are computed on the client only to avoid an SSR/CSR
  // hydration mismatch against `Date.now()`. Refresh once on mount (deferred
  // out of the effect body) and then periodically.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const raf = requestAnimationFrame(tick);
    const id = setInterval(tick, 60_000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, []);

  // ⌘K / Ctrl-K focuses the search box from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    let out = searchRecords(records, query, scope, sortBy);
    // Only the active source is selectable; unchecking it hides its results.
    out = out.filter((r) => selectedSources.has(r.sourceKind));
    if (selectedTags.size > 0) {
      out = out.filter((r) => (r.tags ?? []).some((t) => selectedTags.has(t)));
    }
    if (lastUpdated !== "any" && now > 0) {
      const cutoff = now - WINDOW_MS[lastUpdated];
      out = out.filter((r) => r.updated >= cutoff);
    }
    return out;
  }, [records, query, scope, sortBy, selectedSources, selectedTags, lastUpdated, now]);

  const toggleSource = (kind: string, enabled: boolean) => {
    if (!enabled) return;
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const clearAll = () => {
    setScope("all");
    setSelectedTags(new Set());
    setLastUpdated("any");
    // Reset to the same source selection the view starts with — the active
    // Library source plus the always-bundled Help docs.
    setSelectedSources(new Set<string>([sourceKind, "help"]));
  };

  const hasQuery = query.trim().length > 0;

  return (
    <div className="search-page">
      <div className="search-main">
        <header className="search-head">
          <h1 className="search-title">Search &amp; Library</h1>
          <p className="search-subtitle">
            Search across your connected sources. Preview instantly from the source.
          </p>
        </header>

        <div className="search-box">
          <Search className="search-box-icon" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            className="search-box-input"
            placeholder="Search your library…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search your library"
          />
          {hasQuery && (
            <button
              type="button"
              className="search-box-clear"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
          <kbd className="search-box-kbd">⌘K</kbd>
        </div>

        <div className="search-scopes">
          <div className="search-tabs" role="tablist" aria-label="Result scope">
            {SCOPES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="tab"
                aria-selected={scope === s.value}
                className={`search-tab${scope === s.value ? " is-active" : ""}`}
                onClick={() => setScope(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {hasQuery ? (
          <>
            <div className="search-results-head">
              <span>
                Found <strong>{results.length}</strong>{" "}
                {results.length === 1 ? "result" : "results"}
              </span>
              <button
                type="button"
                className="search-sort"
                onClick={() =>
                  setSortBy((current) => (current === "relevance" ? "recent" : "relevance"))
                }
                aria-label={`Sorted by ${
                  sortBy === "relevance" ? "relevance" : "recent"
                }. Switch to ${sortBy === "relevance" ? "recent" : "relevance"} sort.`}
              >
                Sorted by {sortBy === "relevance" ? "relevance" : "recent"}
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>

            {results.length > 0 ? (
              <ul className="search-results">
                {results.map((r) => {
                  const KindIcon = KIND_ICON[r.kind];
                  const SourceIco = SOURCE_ICON[r.sourceKind];
                  const time = relativeTime(r.updated, now);
                  return (
                    <li key={r.id}>
                      <Link href={r.href} className="search-result">
                        <span className={`search-result-icon kind-${r.kind}`} aria-hidden>
                          <KindIcon className="h-4 w-4" />
                        </span>
                        <span className="search-result-body">
                          <span className="search-result-titlerow">
                            <span className="search-result-title">{highlight(r.title, query)}</span>
                            <span className={`search-badge src-${r.sourceKind}`}>
                              <SourceIco className="h-3 w-3" aria-hidden />
                              {r.sourceName}
                            </span>
                          </span>
                          <span className="search-result-path">{r.path}</span>
                          {r.snippet && (
                            <span className="search-result-snippet">
                              {highlight(r.snippet, query)}
                            </span>
                          )}
                        </span>
                        {time && <time className="search-result-time">{time}</time>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="search-empty">
                <Search className="h-5 w-5" aria-hidden />
                <p>
                  No results for <strong>“{query}”</strong>
                </p>
                <span>Try a different term or clear your filters.</span>
              </div>
            )}
          </>
        ) : (
          <div className="search-idle">
            <Sparkles className="h-5 w-5" aria-hidden />
            <p>Start typing to search your library.</p>
            <span>
              {counts.page} pages · {counts.heading} headings · {counts.code} code blocks indexed.
            </span>
          </div>
        )}

        <div className="search-cards">
          <div className="search-card">
            <span className="search-card-icon">
              <Search className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <div className="search-card-title">Search across connected sources</div>
              <div className="search-card-text">One search. All your content.</div>
            </div>
          </div>
          <div className="search-card">
            <span className="search-card-icon">
              <Eye className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <div className="search-card-title">Preview instantly from source</div>
              <div className="search-card-text">
                Open and preview MDX files without leaving Verto.
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside className="search-filters" aria-label="Filters">
        <div className="search-filters-head">
          <span className="search-filters-title">Filters</span>
          <button type="button" className="search-filters-clear" onClick={clearAll}>
            Clear all
          </button>
        </div>

        <section className="search-filter-group">
          <h3 className="search-filter-label">Sources</h3>
          {DESIGN_SOURCES.map((s) => {
            const connected = isConnectedSource(s.kind);
            const Icon = SOURCE_ICON[s.kind];
            return (
              <label key={s.kind} className={`search-check${connected ? "" : " is-disabled"}`}>
                <input
                  type="checkbox"
                  checked={connected && selectedSources.has(s.kind)}
                  disabled={!connected}
                  onChange={() => toggleSource(s.kind, connected)}
                />
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="flex-1">{s.label}</span>
                <span className="search-check-count">{connected ? 1 : 0}</span>
              </label>
            );
          })}
        </section>

        <section className="search-filter-group">
          <h3 className="search-filter-label">Content type</h3>
          {(
            [
              { value: "all", label: "All", icon: FileText, count: counts.all },
              { value: "page", label: "Pages", icon: FileText, count: counts.page },
              { value: "heading", label: "Headings", icon: Hash, count: counts.heading },
              { value: "code", label: "Code", icon: Code2, count: counts.code },
              { value: "folder", label: "Folders", icon: Folder, count: counts.folder },
            ] as const
          ).map((row) => {
            const Icon = row.icon;
            return (
              <button
                key={row.value}
                type="button"
                className={`search-type${scope === row.value ? " is-active" : ""}`}
                onClick={() => setScope(row.value)}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="flex-1">{row.label}</span>
                <span className="search-type-count">{row.count}</span>
              </button>
            );
          })}
        </section>

        {tags.length > 0 && (
          <section className="search-filter-group">
            <h3 className="search-filter-label">Tags</h3>
            <div className="search-tagrow">
              {tags.map((tag) => {
                const on = selectedTags.has(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`search-tag${on ? " is-active" : ""}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                    {on && <X className="h-3 w-3" aria-hidden />}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="search-filter-group">
          <h3 className="search-filter-label">Last updated</h3>
          <select
            className="search-native-select"
            value={lastUpdated}
            onChange={(e) => setLastUpdated(e.target.value as LastUpdated)}
            aria-label="Last updated"
          >
            <option value="any">Any time</option>
            <option value="today">Past 24 hours</option>
            <option value="week">Past week</option>
            <option value="month">Past month</option>
          </select>
        </section>

        <section className="search-status">
          <h3 className="search-filter-label">Source status</h3>
          {DESIGN_SOURCES.map((s) => {
            const connected = isConnectedSource(s.kind);
            const Icon = SOURCE_ICON[s.kind];
            const statusText = connected
              ? "Connected"
              : s.comingSoon
                ? "Coming soon"
                : "Not connected";
            return (
              <div key={s.kind} className="search-status-row">
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span className="flex-1">{s.label}</span>
                <span className={`search-status-dot${connected ? " is-on" : ""}`} aria-hidden />
                <span className="search-status-text">{statusText}</span>
              </div>
            );
          })}
          <Link href="/integrations" className="search-status-foot" title={sourceLabel}>
            <Settings className="h-3.5 w-3.5" aria-hidden />
            Manage sources
            <span className="search-status-active">· {sourceName}</span>
          </Link>
        </section>
      </aside>
    </div>
  );
}
