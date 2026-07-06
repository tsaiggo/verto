"use client";

import { useState } from "react";

interface PageTabsProps {
  tabs: string[];
  initial?: number;
}

/**
 * Visual underline tab row used under a page header (Library, Bookmarks,
 * Knowledge Studio, Activity). Tracks the active tab locally; content filtering
 * is not wired to these yet, so switching only moves the active indicator.
 */
export default function PageTabs({ tabs, initial = 0 }: PageTabsProps) {
  const [active, setActive] = useState(initial);
  return (
    <div className="v-tabs" role="tablist">
      {tabs.map((tab, i) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={i === active}
          className={`v-tab${i === active ? " is-active" : ""}`}
          onClick={() => setActive(i)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
