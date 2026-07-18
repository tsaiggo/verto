"use client";

import { useRef } from "react";

export type LibraryTabId = "all" | "notes" | "drafts" | "images" | "archives";

const LIBRARY_TABS_ID = "library-view-tabs";

export function libraryTabId(tab: LibraryTabId): string {
  return `${LIBRARY_TABS_ID}-${tab}`;
}

export default function LibraryTabs({
  tabs,
  value,
  counts,
  onValueChange,
}: {
  tabs: { id: LibraryTabId; label: string }[];
  value: LibraryTabId;
  counts: Record<LibraryTabId, number>;
  onValueChange: (tab: LibraryTabId) => void;
}) {
  const tabRefs = useRef(new Map<LibraryTabId, HTMLButtonElement>());
  const focusTab = (index: number) => {
    const next = tabs[index];
    if (!next) return;
    onValueChange(next.id);
    requestAnimationFrame(() => tabRefs.current.get(next.id)?.focus());
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let target: number | null = null;
    if (event.key === "ArrowLeft") target = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "ArrowRight") target = (index + 1) % tabs.length;
    if (event.key === "Home") target = 0;
    if (event.key === "End") target = tabs.length - 1;
    if (target == null) return;
    event.preventDefault();
    focusTab(target);
  };

  return (
    <div className="content-tabs lib-tabs" role="tablist" aria-label="Library views" data-page-tabs>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          id={libraryTabId(tab.id)}
          type="button"
          className={`content-tab v-tab${tab.id === value ? " is-active" : ""}`}
          onClick={() => onValueChange(tab.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
          role="tab"
          aria-selected={tab.id === value}
          aria-controls="library-documents"
          tabIndex={tab.id === value ? 0 : -1}
          ref={(node) => {
            if (node) tabRefs.current.set(tab.id, node);
            else tabRefs.current.delete(tab.id);
          }}
        >
          {tab.label}
          <span className="content-tab__count lib-tab-count" aria-label={`${counts[tab.id]} items`}>
            {counts[tab.id]}
          </span>
        </button>
      ))}
    </div>
  );
}
