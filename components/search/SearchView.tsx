"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
  SetStateAction,
} from "react";
import {
  searchRecords,
  type SearchCounts,
  type SearchRecord,
  type SearchSort,
  type SearchScope,
} from "@/lib/search";
import { SCOPES, WINDOW_MS, type LastUpdated } from "@/components/search/search-data";
import { SearchBox } from "@/components/search/SearchBox";
import { SearchResults } from "@/components/search/SearchResults";
import { SearchFilters, type SearchFiltersProps } from "@/components/search/SearchFilters";
import { MobileSearchFilters } from "@/components/search/MobileSearchFilters";
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
  sourceName: string;
  sourceLabel: string;
  initialQuery?: string;
}

type SearchFilterProps = Omit<SearchFiltersProps, "className">;

interface SearchPageBodyProps {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  inputRef: RefObject<HTMLInputElement | null>;
  scope: SearchScope;
  setScope: Dispatch<SetStateAction<SearchScope>>;
  selectedFilterCount: number;
  filters: SearchFilterProps;
  hasQuery: boolean;
  results: SearchRecord[];
  now: number;
  counts: SearchCounts;
  sortBy: SearchSort;
  setSortBy: Dispatch<SetStateAction<SearchSort>>;
}

function SearchPageHeader() {
  return (
    <header className="search-head">
      <h1 className="search-title">Search</h1>
      <p className="search-subtitle">Find pages, headings, and code in your active sources.</p>
    </header>
  );
}

export default function SearchView({
  records,
  counts,
  tags,
  sourceName,
  sourceLabel,
  initialQuery = "",
}: SearchViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<SearchScope>("all");
  const [sortBy, setSortBy] = useState<SearchSort>("relevance");
  // "local" is the UI's logical active-library source. Build-time OneDrive
  // records and runtime local-folder records both map to it, so switching the
  // active source cannot silently filter every result out.
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    () => new Set<string>(["local", "help"])
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
  const activeSourceName = runtimeLocal.status === "ready" ? "Local Library" : sourceName;
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
    out = out.filter((r) => selectedSources.has(r.sourceKind === "help" ? "help" : "local"));
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
    setSelectedSources(new Set<string>(["local", "help"]));
  };

  const hasQuery = query.trim().length > 0;
  const selectedFilterCount =
    selectedTags.size + (lastUpdated === "any" ? 0 : 1) + (selectedSources.size === 2 ? 0 : 1);
  const filters: SearchFilterProps = {
    sourceName: activeSourceName,
    sourceLabel: activeSourceLabel,
    selectedSources,
    toggleSource,
    tags: activeTags,
    selectedTags,
    toggleTag,
    lastUpdated,
    setLastUpdated,
    clearAll,
  };

  return (
    <SearchPageBody
      query={query}
      setQuery={setQuery}
      inputRef={inputRef}
      scope={scope}
      setScope={setScope}
      selectedFilterCount={selectedFilterCount}
      filters={filters}
      hasQuery={hasQuery}
      results={results}
      now={now}
      counts={activeCounts}
      sortBy={sortBy}
      setSortBy={setSortBy}
    />
  );
}

function SearchPageBody({
  query,
  setQuery,
  inputRef,
  scope,
  setScope,
  selectedFilterCount,
  filters,
  hasQuery,
  results,
  now,
  counts,
  sortBy,
  setSortBy,
}: SearchPageBodyProps) {
  const tabRefs = useRef(new Map<SearchScope, HTMLButtonElement>());

  function focusScopeTab(event: ReactKeyboardEvent<HTMLButtonElement>, current: SearchScope) {
    const currentIndex = SCOPES.findIndex((item) => item.value === current);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % SCOPES.length;
    else if (event.key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + SCOPES.length) % SCOPES.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = SCOPES.length - 1;
    else return;

    event.preventDefault();
    const next = SCOPES[nextIndex]?.value;
    if (!next) return;
    setScope(next);
    tabRefs.current.get(next)?.focus();
  }

  return (
    <div className="search-page">
      <div className="search-main">
        <SearchPageHeader />

        <SearchBox query={query} setQuery={setQuery} inputRef={inputRef} scope={scope} />

        <div className="search-scopes">
          <div className="search-tabs" role="tablist" aria-label="Result scope">
            {SCOPES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="tab"
                aria-selected={scope === s.value}
                aria-controls="search-results-panel"
                id={`search-scope-${s.value}`}
                tabIndex={scope === s.value ? 0 : -1}
                className={`search-tab${scope === s.value ? " is-active" : ""}`}
                ref={(node) => {
                  if (node) tabRefs.current.set(s.value, node);
                  else tabRefs.current.delete(s.value);
                }}
                onKeyDown={(event) => focusScopeTab(event, s.value)}
                onClick={() => setScope(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <MobileSearchFilters selectedFilterCount={selectedFilterCount} {...filters} />

        <div
          id="search-results-panel"
          role="tabpanel"
          aria-labelledby={`search-scope-${scope}`}
          tabIndex={0}
        >
          <SearchResults
            hasQuery={hasQuery}
            results={results}
            query={query}
            now={now}
            counts={counts}
            sortBy={sortBy}
            setSortBy={setSortBy}
          />
        </div>
      </div>

      <SearchFilters {...filters} />
    </div>
  );
}
