"use client";

import { useId, useRef } from "react";
import { cn } from "@/lib/utils";

export interface ContentTabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number;
  panelId?: string;
  disabled?: boolean;
}

interface ContentTabsProps<T extends string> {
  items: ContentTabItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  label: string;
  id?: string;
  className?: string;
}

/** Keep the tab and panel relationship predictable for route-owned tabpanels. */
export function contentTabId(tabsId: string, itemId: string): string {
  return `${tabsId}-tab-${encodeURIComponent(itemId)}`;
}

/** Controlled, keyboard-complete filter tabs shared by product routes. */
export default function ContentTabs<T extends string>({
  items,
  value,
  onValueChange,
  label,
  id,
  className,
}: ContentTabsProps<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const generatedId = useId();
  const tabsId = id ?? `content-tabs-${generatedId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const selectAt = (index: number) => {
    const enabled = items.filter((item) => !item.disabled);
    const next = enabled[index];
    if (!next) return;
    onValueChange(next.id);
    requestAnimationFrame(() => refs.current.get(next.id)?.focus());
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const enabled = items.filter((item) => !item.disabled);
    const current = enabled.findIndex((item) => item.id === value);
    if (current < 0) return;

    let next: number | null = null;
    if (event.key === "ArrowLeft") next = (current - 1 + enabled.length) % enabled.length;
    if (event.key === "ArrowRight") next = (current + 1) % enabled.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = enabled.length - 1;
    if (next == null) return;

    event.preventDefault();
    selectAt(next);
  };

  return (
    <div id={tabsId} className={cn("content-tabs", className)} role="tablist" aria-label={label}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            id={contentTabId(tabsId, item.id)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={item.panelId}
            className={cn("content-tab", active && "is-active")}
            disabled={item.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(item.id)}
            onKeyDown={onKeyDown}
            ref={(node) => {
              if (node) refs.current.set(item.id, node);
              else refs.current.delete(item.id);
            }}
          >
            <span>{item.label}</span>
            {typeof item.count === "number" ? (
              <span className="content-tab__count" aria-label={`${item.count} items`}>
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
