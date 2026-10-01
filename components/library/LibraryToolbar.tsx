"use client";

import { LayoutGrid, List, Search, SlidersHorizontal, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { LibraryDisplay } from "@/components/library/LibraryBrowser";
import styles from "@/components/library/Library.module.css";

interface LibraryToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  section: string;
  onSectionChange: (value: string) => void;
  tag: string;
  onTagChange: (value: string) => void;
  sections: string[];
  tags: string[];
  display: LibraryDisplay;
  onDisplayChange: (value: LibraryDisplay) => void;
  resultLabel: string;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

function FilterField({
  label,
  value,
  options,
  onChange,
  prefix = "",
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  prefix?: string;
}) {
  const available = value !== "all" && !options.includes(value) ? [...options, value] : options;
  return (
    <label className={styles.filterField}>
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={`Filter by ${label.toLowerCase()}`}
      >
        <option value="all">All {label.toLowerCase()}s</option>
        {available.map((item) => (
          <option key={item} value={item}>
            {prefix}
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function LibraryToolbar({
  query,
  onQueryChange,
  section,
  onSectionChange,
  tag,
  onTagChange,
  sections,
  tags,
  display,
  onDisplayChange,
  resultLabel,
  hasActiveFilters,
  onClearFilters,
}: LibraryToolbarProps) {
  const filterCount = Number(section !== "all") + Number(tag !== "all");

  return (
    <div className={styles.discoveryTools}>
      <div className={styles.toolbar}>
        <div className={styles.search} role="search">
          <Search aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search documents"
            aria-label="Search documents"
          />
          {query ? (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => onQueryChange("")}
              aria-label="Clear document search"
            >
              <X aria-hidden />
            </button>
          ) : null}
        </div>
        {sections.length > 1 || tags.length > 0 || filterCount > 0 ? (
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={styles.filterButton} aria-label="Filter documents">
                <SlidersHorizontal aria-hidden />
                <span>Filter</span>
                {filterCount > 0 ? <span className={styles.filterCount}>{filterCount}</span> : null}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className={styles.filterPopover}
              aria-label="Document filters"
            >
              <h2>Filter documents</h2>
              {sections.length > 1 || section !== "all" ? (
                <FilterField
                  label="Section"
                  value={section}
                  options={sections}
                  onChange={onSectionChange}
                />
              ) : null}
              {tags.length > 0 || tag !== "all" ? (
                <FilterField
                  label="Tag"
                  value={tag}
                  options={tags}
                  onChange={onTagChange}
                  prefix="#"
                />
              ) : null}
            </PopoverContent>
          </Popover>
        ) : null}
        <div className={styles.displaySwitch} role="group" aria-label="Library layout">
          <button
            type="button"
            aria-label="List view"
            aria-pressed={display === "list"}
            onClick={() => onDisplayChange("list")}
            title="List view"
          >
            <List aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Shelf view"
            aria-pressed={display === "shelf"}
            onClick={() => onDisplayChange("shelf")}
            title="Shelf view"
          >
            <LayoutGrid aria-hidden />
          </button>
        </div>
      </div>
      <div className={styles.resultBar}>
        <p aria-live="polite">{resultLabel}</p>
        {hasActiveFilters ? (
          <div className={styles.resultActions}>
            {section !== "all" ? <span className={styles.activeFilter}>{section}</span> : null}
            {tag !== "all" ? <span className={styles.activeFilter}>#{tag}</span> : null}
            <button type="button" className={styles.resetFilters} onClick={onClearFilters}>
              Clear filters
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
