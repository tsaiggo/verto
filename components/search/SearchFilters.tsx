// Search filters sidebar: sources, content type, tags, last-updated, source status.
import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { Settings, X } from "lucide-react";
import {
  DESIGN_SOURCES,
  type LastUpdated,
  type SearchFilterSourceKind,
  SOURCE_ICON,
} from "@/components/search/search-data";

export interface SearchFiltersProps {
  className?: string;
  sourceName: string;
  sourceLabel: string;
  selectedSources: Set<string>;
  toggleSource: (kind: string, enabled: boolean) => void;
  tags: string[];
  selectedTags: Set<string>;
  toggleTag: (tag: string) => void;
  lastUpdated: LastUpdated;
  setLastUpdated: Dispatch<SetStateAction<LastUpdated>>;
  clearAll: () => void;
}

export function SearchFilters({
  className,
  sourceName,
  sourceLabel,
  selectedSources,
  toggleSource,
  tags,
  selectedTags,
  toggleTag,
  lastUpdated,
  setLastUpdated,
  clearAll,
}: SearchFiltersProps) {
  const isConnectedSource = (kind: SearchFilterSourceKind) => kind === "help" || kind === "local";
  const hasActiveFilters =
    selectedSources.size !== DESIGN_SOURCES.length ||
    selectedTags.size > 0 ||
    lastUpdated !== "any";

  return (
    <aside className={`search-filters${className ? ` ${className}` : ""}`} aria-label="Filters">
      <div className="search-filters-head">
        <span className="search-filters-title">Filters</span>
        <button
          type="button"
          className="search-filters-clear"
          onClick={clearAll}
          disabled={!hasActiveFilters}
        >
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
            </label>
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

      <Link href="/integrations" className="search-status-foot" title={sourceLabel}>
        <Settings className="h-3.5 w-3.5" aria-hidden />
        Manage sources
        <span className="search-status-active">· {sourceName}</span>
      </Link>
    </aside>
  );
}
