import type { RuntimeLocalIndexState } from "@/components/runtime/useRuntimeLocalIndex";
import type { SearchCounts, SearchRecord, SearchScope, SearchSort } from "@/lib/search";
import type { SourceKind } from "@/lib/source-info";
import type { LastUpdated, SearchSourceStatus } from "@/components/search/search-data";

/** Pure route-state helpers kept separate from the client view for regression tests. */
const EMPTY_COUNTS: SearchCounts = {
  all: 0,
  page: 0,
  heading: 0,
  code: 0,
  folder: 0,
};

interface BuildSearchSource {
  records: SearchRecord[];
  counts: SearchCounts;
  tags: string[];
  kind: SourceKind;
  name: string;
  label: string;
}

export interface ActiveSearchSource {
  records: SearchRecord[];
  counts: SearchCounts;
  tags: string[];
  kind: SearchRecord["sourceKind"];
  name: string;
  label: string;
  status: SearchSourceStatus;
  error?: string;
}

export interface SearchRouteState {
  query: string;
  scope: SearchScope;
  sourceEnabled: boolean;
  selectedTags: string[];
  lastUpdated: LastUpdated;
  sortBy: SearchSort;
}

const SEARCH_SCOPES: readonly SearchScope[] = ["all", "page", "heading", "code", "folder"];
const LAST_UPDATED_VALUES: readonly LastUpdated[] = ["any", "today", "week", "month"];
const SEARCH_SORTS: readonly SearchSort[] = ["relevance", "recent"];
const SEARCH_ROUTE_PARAMS = ["q", "type", "source", "tag", "time", "sort"] as const;

function isOneOf<T extends string>(value: string | null, options: readonly T[]): value is T {
  return value !== null && options.includes(value as T);
}

function normalizedTags(tags: readonly string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

/** Parse every Search control from a URL. Invalid values fall back to quiet defaults. */
export function parseSearchRouteState(href: string, initialQuery = ""): SearchRouteState {
  const params = new URL(href, "https://verto.local").searchParams;
  const scope = params.get("type");
  const lastUpdated = params.get("time");
  const sortBy = params.get("sort");

  return {
    query: params.get("q")?.trim() || initialQuery.trim(),
    scope: isOneOf(scope, SEARCH_SCOPES) ? scope : "all",
    sourceEnabled: params.get("source") !== "none",
    selectedTags: normalizedTags(params.getAll("tag")),
    lastUpdated: isOneOf(lastUpdated, LAST_UPDATED_VALUES) ? lastUpdated : "any",
    sortBy: isOneOf(sortBy, SEARCH_SORTS) ? sortBy : "relevance",
  };
}

/**
 * Serialize Search state without polluting the URL with defaults. Unknown query
 * parameters and the hash are preserved so Search can coexist with route metadata.
 */
export function searchHrefWithState(href: string, state: SearchRouteState): string {
  const url = new URL(href, "https://verto.local");
  for (const key of SEARCH_ROUTE_PARAMS) url.searchParams.delete(key);

  const query = state.query.trim();
  if (query) url.searchParams.append("q", query);
  if (state.scope !== "all") url.searchParams.append("type", state.scope);
  if (!state.sourceEnabled) url.searchParams.append("source", "none");
  for (const tag of normalizedTags(state.selectedTags).sort((a, b) => a.localeCompare(b))) {
    url.searchParams.append("tag", tag);
  }
  if (state.lastUpdated !== "any") url.searchParams.append("time", state.lastUpdated);
  if (state.sortBy !== "relevance") url.searchParams.append("sort", state.sortBy);

  return `${url.pathname}${url.search}${url.hash}`;
}

export function deriveActiveSearchSource(
  runtime: RuntimeLocalIndexState,
  build: BuildSearchSource
): ActiveSearchSource {
  if (runtime.status === "idle") return { ...build, status: "ready" };
  if (runtime.status === "ready") {
    return {
      records: runtime.index.searchRecords,
      counts: runtime.index.counts,
      tags: runtime.index.tags,
      kind: "local",
      name: "Local Library",
      label: runtime.folder,
      status: "ready",
    };
  }
  return {
    records: [],
    counts: EMPTY_COUNTS,
    tags: [],
    kind: "local",
    name: "Local Library",
    label: runtime.folder,
    status: runtime.status,
    error: runtime.status === "error" ? runtime.error : undefined,
  };
}

export function agentHrefForQuery(query: string): string {
  const normalized = query.trim();
  if (!normalized) return "/agent";
  const params = new URLSearchParams({
    prompt: `Search my library for: ${normalized}`,
  });
  return `/agent?${params.toString()}`;
}
