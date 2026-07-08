// Search filters sidebar: sources, content type, tags, last-updated, source status.
import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import { Code2, FileText, Folder, Hash, Settings, X } from "lucide-react";
import type { SearchCounts, SearchScope } from "@/lib/search";
import type { SourceKind } from "@/lib/source-info";
import {
  DESIGN_SOURCES,
  type LastUpdated,
  type SearchFilterSourceKind,
  SOURCE_ICON,
} from "@/components/search/search-data";

interface SearchFiltersProps {
  sourceKind: SourceKind;
  sourceName: string;
  sourceLabel: string;
  selectedSources: Set<string>;
  toggleSource: (kind: string, enabled: boolean) => void;
  scope: SearchScope;
  setScope: Dispatch<SetStateAction<SearchScope>>;
  counts: SearchCounts;
  tags: string[];
  selectedTags: Set<string>;
  toggleTag: (tag: string) => void;
  lastUpdated: LastUpdated;
  setLastUpdated: Dispatch<SetStateAction<LastUpdated>>;
  clearAll: () => void;
}

export function SearchFilters({
  sourceKind,
  sourceName,
  sourceLabel,
  selectedSources,
  toggleSource,
  scope,
  setScope,
  counts,
  tags,
  selectedTags,
  toggleTag,
  lastUpdated,
  setLastUpdated,
  clearAll,
}: SearchFiltersProps) {
  const isConnectedSource = (kind: SearchFilterSourceKind) =>
    kind === "help" || (kind === "local" && sourceKind === "local");

  return (
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
          const statusText = connected ? "Connected" : "Not connected";
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
  );
}
