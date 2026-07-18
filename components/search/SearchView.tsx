"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { SearchFilters, type SearchFiltersProps } from "@/components/search/SearchFilters";
import { MobileSearchFilters } from "@/components/search/MobileSearchFilters";
import { deriveActiveSearchSource, type SearchRouteState } from "@/components/search/search-state";
import { useSearchRouteEffects } from "@/components/search/useSearchRouteEffects";
import { useRuntimeLocalIndex } from "@/components/runtime/useRuntimeLocalIndex";
import { ContentBody, ContentHeader, ContentPage } from "@/components/layout/ContentPage";
import ContentTabs, { contentTabId } from "@/components/layout/ContentTabs";
import { ContentStatus, ContentToolbar } from "@/components/ui/content-primitives";
import styles from "@/components/search/SearchView.module.css";

interface SearchViewProps {
  records: SearchRecord[];
  counts: SearchCounts;
  tags: string[];
  sourceKind: SourceKind;
  sourceName: string;
  sourceLabel: string;
  initialQuery?: string;
}

type SearchFilterProps = Omit<SearchFiltersProps, "className">;

const SEARCH_TABS_ID = "search-result-scope";
const SEARCH_PANEL_ID = "search-results-panel";

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
  const [sourceEnabled, setSourceEnabled] = useState(true);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<LastUpdated>("any");
  const inputRef = useRef<HTMLInputElement>(null);
  const runtimeLocal = useRuntimeLocalIndex();
  const activeSource = deriveActiveSearchSource(runtimeLocal, {
    records,
    counts,
    tags,
    kind: sourceKind,
    name: sourceName,
    label: sourceLabel,
  });
  const effectiveSelectedTags = useMemo(
    () => new Set([...selectedTags].filter((tag) => activeSource.tags.includes(tag))),
    [activeSource.tags, selectedTags]
  );
  const routeState = useMemo<SearchRouteState>(
    () => ({
      query,
      scope,
      sourceEnabled,
      selectedTags: [...selectedTags],
      lastUpdated,
      sortBy,
    }),
    [lastUpdated, query, scope, selectedTags, sortBy, sourceEnabled]
  );
  const applyRouteState = useCallback((next: SearchRouteState) => {
    setQuery(next.query);
    setScope(next.scope);
    setSourceEnabled(next.sourceEnabled);
    setSelectedTags(new Set(next.selectedTags));
    setLastUpdated(next.lastUpdated);
    setSortBy(next.sortBy);
  }, []);
  const now = useSearchRouteEffects({
    state: routeState,
    onStateChange: applyRouteState,
    initialQuery,
    inputRef,
  });

  const results = useMemo(() => {
    if (!sourceEnabled || activeSource.status !== "ready") return [];
    let next = searchRecords(activeSource.records, query, scope, sortBy);
    if (effectiveSelectedTags.size > 0) {
      next = next.filter((record) =>
        (record.tags ?? []).some((tag) => effectiveSelectedTags.has(tag))
      );
    }
    if (lastUpdated !== "any" && now > 0) {
      const cutoff = now - WINDOW_MS[lastUpdated];
      next = next.filter((record) => record.updated >= cutoff);
    }
    return next;
  }, [
    activeSource.records,
    activeSource.status,
    lastUpdated,
    now,
    query,
    scope,
    effectiveSelectedTags,
    sortBy,
    sourceEnabled,
  ]);

  const toggleTag = (tag: string) => {
    setSelectedTags((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const clearAll = () => {
    setScope("all");
    setSelectedTags(new Set());
    setLastUpdated("any");
    setSourceEnabled(true);
  };

  const selectedFilterCount =
    effectiveSelectedTags.size + (lastUpdated === "any" ? 0 : 1) + (sourceEnabled ? 0 : 1);
  const filters: SearchFilterProps = {
    sourceKind: activeSource.kind,
    sourceName: activeSource.name,
    sourceLabel: activeSource.label,
    sourceCount: activeSource.counts.all,
    sourceStatus: activeSource.status,
    sourceError: activeSource.error,
    sourceEnabled,
    toggleSource: () => setSourceEnabled((current) => !current),
    tags: activeSource.tags,
    selectedTags: effectiveSelectedTags,
    toggleTag,
    lastUpdated,
    setLastUpdated,
    clearAll,
  };

  const tabItems = SCOPES.map((item) => ({
    id: item.value,
    label: item.label,
    count: activeSource.counts[item.value],
    panelId: SEARCH_PANEL_ID,
  }));
  const hasQuery = query.trim().length > 0;

  return (
    <ContentPage width="wide" className={styles.page}>
      <ContentHeader
        title="Search"
        description="Find pages, headings, code, and folders in your active source."
        meta={activeSource.label}
      />

      <ContentToolbar className={styles.searchToolbar}>
        <SearchBox query={query} setQuery={setQuery} inputRef={inputRef} />
      </ContentToolbar>

      <ContentTabs
        id={SEARCH_TABS_ID}
        items={tabItems}
        value={scope}
        onValueChange={setScope}
        label="Result scope"
      />

      <MobileSearchFilters selectedFilterCount={selectedFilterCount} {...filters} />

      <ContentBody aside={<SearchFilters {...filters} />}>
        <section
          id={SEARCH_PANEL_ID}
          role="tabpanel"
          aria-labelledby={contentTabId(SEARCH_TABS_ID, scope)}
          aria-busy={activeSource.status === "loading" || undefined}
          className={styles.resultsRegion}
          tabIndex={0}
        >
          {activeSource.status === "loading" ? (
            <ContentStatus
              status="loading"
              title={`Indexing ${activeSource.name}`}
              description={activeSource.label}
            />
          ) : activeSource.status === "error" ? (
            <ContentStatus
              status="error"
              title="The active source could not be indexed"
              description={activeSource.error}
              action={
                <Link href="/integrations" className={styles.statusAction}>
                  Manage source
                </Link>
              }
            />
          ) : (
            <SearchResults
              hasQuery={hasQuery}
              results={results}
              query={query}
              now={now}
              counts={activeSource.counts}
              sortBy={sortBy}
              setSortBy={setSortBy}
            />
          )}
        </section>
      </ContentBody>
    </ContentPage>
  );
}
