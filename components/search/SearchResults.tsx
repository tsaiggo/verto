// Search results region: results header + sort toggle, result list, empty and idle states.
import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { ChevronDown, Search, Sparkles } from "lucide-react";
import type { SearchCounts, SearchRecord, SearchSort } from "@/lib/search";
import { KIND_ICON, SOURCE_ICON } from "@/components/search/search-data";
import { highlight, relativeTime } from "@/components/search/search-format";

interface SearchResultsProps {
  hasQuery: boolean;
  results: SearchRecord[];
  query: string;
  now: number;
  counts: SearchCounts;
  sortBy: SearchSort;
  setSortBy: Dispatch<SetStateAction<SearchSort>>;
}

export function SearchResults({
  hasQuery,
  results,
  query,
  now,
  counts,
  sortBy,
  setSortBy,
}: SearchResultsProps) {
  if (!hasQuery) {
    return (
      <div className="search-idle">
        <span className="search-empty-icon" aria-hidden>
          <Sparkles className="h-6 w-6" />
        </span>
        <p>Start typing to search your library.</p>
        <span>
          {counts.page} pages · {counts.heading} headings · {counts.code} code blocks indexed.
        </span>
      </div>
    );
  }

  return (
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
          <span className="search-empty-icon" aria-hidden>
            <Search className="h-6 w-6" />
          </span>
          <p>
            No results for <strong>“{query}”</strong>
          </p>
          <span>Try a different term or clear your filters.</span>
        </div>
      )}
    </>
  );
}
