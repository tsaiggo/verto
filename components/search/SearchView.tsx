"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  searchRecords,
  type SearchCounts,
  type SearchRecord,
  type SearchSort,
  type SearchScope,
} from "@/lib/search";
import type { SourceKind } from "@/lib/source-info";
import { SCOPES, WINDOW_MS, type LastUpdated } from "@/components/search/search-data";
import { SearchBox } from "@/components/search/SearchBox";
import { SearchResults } from "@/components/search/SearchResults";
import { SearchFilters } from "@/components/search/SearchFilters";
import { useRuntimeLocalIndex } from "@/components/runtime/useRuntimeLocalIndex";

const EMPTY_SEARCH_RECORDS: SearchRecord[] = [];

const EMPTY_SEARCH_COUNTS: SearchCounts = {
  all: 0,
  page: 0,
  heading: 0,
  code: 0,
  folder: 0,
};

interface SearchViewProps {
  records: SearchRecord[];
  counts: SearchCounts;
  tags: string[];
  sourceKind: SourceKind;
  sourceName: string;
  sourceLabel: string;
  initialQuery?: string;
}

export default function SearchView({
  records,
  counts,
  tags,
  sourceKind,
  sourceName,
  sourceLabel,
  initialQuery = "",
}: SearchViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<SearchScope>("all");
  const [sortBy, setSortBy] = useState<SearchSort>("relevance");
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    () => new Set<string>([sourceKind, "help"])
  );
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<LastUpdated>("any");
  const [now, setNow] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const runtimeLocal = useRuntimeLocalIndex();
  const activeRecords =
    runtimeLocal.status === "ready"
      ? runtimeLocal.index.searchRecords
      : runtimeLocal.status === "idle"
        ? records
        : EMPTY_SEARCH_RECORDS;
  const activeCounts =
    runtimeLocal.status === "ready"
      ? runtimeLocal.index.counts
      : runtimeLocal.status === "idle"
        ? counts
        : EMPTY_SEARCH_COUNTS;
  const activeTags = runtimeLocal.status === "ready" ? runtimeLocal.index.tags : tags;
  const activeSourceName = runtimeLocal.status === "ready" ? "Local Files" : sourceName;
  const activeSourceLabel = runtimeLocal.status === "ready" ? runtimeLocal.folder : sourceLabel;

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const queryParam = new URLSearchParams(window.location.search).get("q")?.trim() ?? "";
      if (queryParam) setQuery(queryParam);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

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
    let out = searchRecords(activeRecords, query, scope, sortBy);
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
  }, [activeRecords, query, scope, sortBy, selectedSources, selectedTags, lastUpdated, now]);

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

        <SearchBox query={query} setQuery={setQuery} inputRef={inputRef} />

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

        <SearchResults
          hasQuery={hasQuery}
          results={results}
          query={query}
          now={now}
          counts={activeCounts}
          sortBy={sortBy}
          setSortBy={setSortBy}
        />
      </div>

      <SearchFilters
        sourceKind={sourceKind}
        sourceName={activeSourceName}
        sourceLabel={activeSourceLabel}
        selectedSources={selectedSources}
        toggleSource={toggleSource}
        scope={scope}
        setScope={setScope}
        counts={activeCounts}
        tags={activeTags}
        selectedTags={selectedTags}
        toggleTag={toggleTag}
        lastUpdated={lastUpdated}
        setLastUpdated={setLastUpdated}
        clearAll={clearAll}
      />
    </div>
  );
}
