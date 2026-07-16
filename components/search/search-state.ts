import type { RuntimeLocalIndexState } from "@/components/runtime/useRuntimeLocalIndex";
import type { SearchCounts, SearchRecord } from "@/lib/search";
import type { SourceKind } from "@/lib/source-info";
import type { SearchSourceStatus } from "@/components/search/search-data";

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

export function searchHrefWithQuery(href: string, query: string): string {
  const url = new URL(href, "https://verto.local");
  const normalized = query.trim();
  if (normalized) url.searchParams.set("q", normalized);
  else url.searchParams.delete("q");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function agentHrefForQuery(query: string): string {
  const normalized = query.trim();
  if (!normalized) return "/agent";
  const params = new URLSearchParams({
    prompt: `Search my library for: ${normalized}`,
  });
  return `/agent?${params.toString()}`;
}
