import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { Settings, X } from "lucide-react";
import type { SearchRecord } from "@/lib/search";
import {
  SOURCE_ICON,
  type LastUpdated,
  type SearchSourceStatus,
} from "@/components/search/search-data";
import { ContentSection, ContentStatus } from "@/components/ui/content-primitives";
import styles from "@/components/search/SearchView.module.css";

export interface SearchFiltersProps {
  className?: string;
  sourceKind: SearchRecord["sourceKind"];
  sourceName: string;
  sourceLabel: string;
  sourceCount: number;
  sourceStatus: SearchSourceStatus;
  sourceError?: string;
  sourceEnabled: boolean;
  toggleSource: () => void;
  tags: string[];
  selectedTags: Set<string>;
  toggleTag: (tag: string) => void;
  lastUpdated: LastUpdated;
  setLastUpdated: Dispatch<SetStateAction<LastUpdated>>;
  clearAll: () => void;
}

export function SearchFilters({
  className,
  sourceKind,
  sourceName,
  sourceLabel,
  sourceCount,
  sourceStatus,
  sourceError,
  sourceEnabled,
  toggleSource,
  tags,
  selectedTags,
  toggleTag,
  lastUpdated,
  setLastUpdated,
  clearAll,
}: SearchFiltersProps) {
  const SourceIcon = SOURCE_ICON[sourceKind];
  const statusLabel =
    sourceStatus === "loading"
      ? "Indexing"
      : sourceStatus === "error"
        ? "Unavailable"
        : "Connected";

  return (
    <div className={`${styles.filters}${className ? ` ${className}` : ""}`} aria-label="Filters">
      <div className={styles.filtersHeader}>
        <strong>Filters</strong>
        <button type="button" className={styles.clearFilters} onClick={clearAll}>
          Clear all
        </button>
      </div>

      <ContentSection title="Source" className={styles.filterSection}>
        <label className={styles.sourceCheck} title={sourceLabel}>
          <input type="checkbox" checked={sourceEnabled} onChange={toggleSource} />
          <SourceIcon aria-hidden />
          <span className={styles.sourceCheckCopy}>
            <strong>{sourceName}</strong>
            <span>{statusLabel}</span>
          </span>
          <span className={styles.filterCount}>{sourceCount}</span>
        </label>
      </ContentSection>

      {tags.length > 0 ? (
        <ContentSection title="Tags" className={styles.filterSection}>
          <div className={styles.tagList}>
            {tags.map((tag) => {
              const active = selectedTags.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={`${styles.tag}${active ? ` ${styles.tagActive}` : ""}`}
                  aria-pressed={active}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                  {active ? <X aria-hidden /> : null}
                </button>
              );
            })}
          </div>
        </ContentSection>
      ) : null}

      <ContentSection title="Last updated" className={styles.filterSection}>
        <select
          className={styles.dateSelect}
          value={lastUpdated}
          onChange={(event) => setLastUpdated(event.target.value as LastUpdated)}
          aria-label="Last updated"
        >
          <option value="any">Any time</option>
          <option value="today">Past 24 hours</option>
          <option value="week">Past week</option>
          <option value="month">Past month</option>
        </select>
      </ContentSection>

      {sourceStatus === "error" ? (
        <ContentStatus
          status="error"
          title="Source unavailable"
          description={sourceError || "The active source could not be indexed."}
        />
      ) : null}

      <Link href="/integrations" className={styles.manageSources} title={sourceLabel}>
        <Settings aria-hidden />
        Manage sources
      </Link>
    </div>
  );
}
