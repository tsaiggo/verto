"use client";

import { ChevronDown, Search } from "lucide-react";
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
}: LibraryToolbarProps) {
  return (
    <div className={styles.toolbar}>
      <label className={styles.search}>
        <Search aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search documents"
          aria-label="Search documents"
        />
      </label>
      <div className={styles.filters}>
        {sections.length > 1 ? (
          <span className={styles.selectWrap}>
            <select
              className={styles.select}
              value={section}
              onChange={(event) => onSectionChange(event.target.value)}
              aria-label="Filter by section"
            >
              <option value="all">All sections</option>
              {sections.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden />
          </span>
        ) : null}
        {tags.length > 0 ? (
          <span className={styles.selectWrap}>
            <select
              className={styles.select}
              value={tag}
              onChange={(event) => onTagChange(event.target.value)}
              aria-label="Filter by tag"
            >
              <option value="all">All tags</option>
              {tags.map((item) => (
                <option key={item} value={item}>
                  #{item}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden />
          </span>
        ) : null}
      </div>
    </div>
  );
}
