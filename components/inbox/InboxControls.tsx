"use client";
import { ChevronDown, Search } from "lucide-react";
import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { InboxItem } from "@/lib/inbox";
import styles from "./InboxView.module.css";
export type TabFilter = "all" | "unread" | "read" | "archived";
const TABS: ReadonlyArray<{ id: TabFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "read", label: "Read" },
  { id: "archived", label: "Archived" },
];
export function matchesTab(item: InboxItem, tab: TabFilter): boolean {
  if (tab === "all") return item.status !== "archived";
  if (tab === "unread") return item.status === "unread" || item.status === "reading";
  return item.status === tab;
}

export function InboxToolbar({
  items,
  activeTab,
  onTabChange,
  feedsOpen,
  onFeedToggle,
  subscriptionCount,
  failedFeedCount,
}: {
  items: InboxItem[];
  activeTab: TabFilter;
  onTabChange: (tab: TabFilter) => void;
  feedsOpen: boolean;
  onFeedToggle: () => void;
  subscriptionCount: number;
  failedFeedCount: number;
}) {
  const tabRefs = useRef(new Map<TabFilter, HTMLButtonElement>());
  function moveTabFocus(event: ReactKeyboardEvent<HTMLButtonElement>, current: TabFilter) {
    const index = TABS.findIndex((tab) => tab.id === current);
    const nextIndex =
      event.key === "ArrowRight"
        ? (index + 1) % TABS.length
        : event.key === "ArrowLeft"
          ? (index - 1 + TABS.length) % TABS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? TABS.length - 1
              : null;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = TABS[nextIndex].id;
    onTabChange(next);
    tabRefs.current.get(next)?.focus();
  }

  return (
    <div className={styles.toolbar}>
      <nav className={styles.tabs} aria-label="Inbox filters" role="tablist">
        {TABS.map(({ id, label }) => {
          const count = items.filter((item) => matchesTab(item, id)).length;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`inbox-tab-${id}`}
              aria-controls="inbox-results"
              aria-selected={activeTab === id}
              tabIndex={activeTab === id ? 0 : -1}
              className={`${styles.tab}${activeTab === id ? ` ${styles.activeTab}` : ""}`}
              ref={(node) => {
                if (node) tabRefs.current.set(id, node);
                else tabRefs.current.delete(id);
              }}
              onKeyDown={(event) => moveTabFocus(event, id)}
              onClick={() => {
                onTabChange(id);
              }}
            >
              {label}
              <span>{count}</span>
            </button>
          );
        })}
      </nav>
      <button
        type="button"
        className={styles.manageButton}
        aria-expanded={feedsOpen}
        aria-controls="subscriptions"
        onClick={onFeedToggle}
      >
        Manage feeds<span>{subscriptionCount}</span>
        {failedFeedCount > 0 && (
          <span className={styles.feedAttention}>{failedFeedCount} needs retry</span>
        )}
        <ChevronDown aria-hidden className={feedsOpen ? styles.chevronOpen : ""} />
      </button>
    </div>
  );
}
export function InboxFilters({
  query,
  source,
  sources,
  onQueryChange,
  onSourceChange,
}: {
  query: string;
  source: string;
  sources: [string, string][];
  onQueryChange: (query: string) => void;
  onSourceChange: (source: string) => void;
}) {
  return (
    <div className={styles.filters}>
      <label className={styles.search}>
        <Search aria-hidden />
        <input
          type="search"
          aria-label="Search articles"
          placeholder="Search articles"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      {sources.length > 0 && (
        <select
          className={styles.sourceFilter}
          aria-label="Filter by source"
          value={source}
          onChange={(event) => onSourceChange(event.target.value)}
        >
          <option value="">All sources</option>
          {sources.map(([url, name]) => (
            <option key={url} value={url}>
              {name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
