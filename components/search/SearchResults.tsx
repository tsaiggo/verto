import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { ChevronDown, Search, Sparkles } from "lucide-react";
import type { SearchCounts, SearchRecord, SearchSort } from "@/lib/search";
import { KIND_ICON, SOURCE_ICON } from "@/components/search/search-data";
import { highlight, relativeTime } from "@/components/search/search-format";
import { ContentEmptyState, ContentRow, ContentToolbar } from "@/components/ui/content-primitives";
import styles from "@/components/search/SearchView.module.css";

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
      <ContentEmptyState
        compact
        icon={<Sparkles aria-hidden />}
        title="Search your library"
        description={`${counts.page} pages, ${counts.heading} headings, and ${counts.code} code blocks are indexed.`}
      />
    );
  }

  return (
    <>
      <ContentToolbar className={styles.resultsToolbar}>
        <span className={styles.resultCount} aria-live="polite">
          <strong>{results.length}</strong> {results.length === 1 ? "result" : "results"}
        </span>
        <button
          type="button"
          className={styles.sortButton}
          onClick={() => setSortBy((current) => (current === "relevance" ? "recent" : "relevance"))}
          aria-label={`Sorted by ${sortBy}. Switch to ${sortBy === "relevance" ? "recent" : "relevance"} sort.`}
        >
          {sortBy === "relevance" ? "Relevance" : "Recent"}
          <ChevronDown aria-hidden />
        </button>
      </ContentToolbar>

      {results.length > 0 ? (
        <ul className={styles.resultList}>
          {results.map((record) => {
            const KindIcon = KIND_ICON[record.kind];
            const SourceIcon = SOURCE_ICON[record.sourceKind];
            const time = relativeTime(record.updated, now);
            return (
              <li key={record.id}>
                <Link href={record.href} className={styles.resultLink}>
                  <ContentRow
                    className={styles.resultRow}
                    leading={<KindIcon aria-hidden />}
                    title={highlight(record.title, query)}
                    description={
                      <span className={styles.resultDescription}>
                        <span>{record.path}</span>
                        {record.snippet ? <span>{highlight(record.snippet, query)}</span> : null}
                      </span>
                    }
                    metadata={
                      <span className={styles.resultMetadata}>
                        <span className={styles.sourceBadge}>
                          <SourceIcon aria-hidden />
                          {record.sourceName}
                        </span>
                        {time ? <time>{time}</time> : null}
                      </span>
                    }
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <ContentEmptyState
          compact
          icon={<Search aria-hidden />}
          title={`No results for “${query}”`}
          description="Try a different term or clear the active filters."
        />
      )}
    </>
  );
}
