"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, MoreHorizontal, PanelLeft, Plus } from "lucide-react";
import type { LabsSidebarTree, LabsSidebarItem } from "@/lib/sidebar/buildLabsTree";
import styles from "./LabsSidebar.module.css";

export const LABS_SIDEBAR_COLLAPSED_KEY = "verto:labs-sidebar:collapsed";

export interface LabsSidebarProps {
  tree: LabsSidebarTree;
  selected?: string;
  onSelect?: (href: string) => void;
  onCreate?: (groupId: string) => void;
  className?: string;
  defaultCollapsed?: boolean;
}

function readCollapsedFromStorage(fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(LABS_SIDEBAR_COLLAPSED_KEY);
    if (raw === "1" || raw === "true") return true;
    if (raw === "0" || raw === "false") return false;
  } catch {
    // ignore
  }
  return fallback;
}

function writeCollapsedToStorage(value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LABS_SIDEBAR_COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}

export default function LabsSidebar({
  tree,
  selected,
  onSelect,
  onCreate,
  className,
  defaultCollapsed = false,
}: LabsSidebarProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    readCollapsedFromStorage(defaultCollapsed)
  );
  const [groupCollapsed, setGroupCollapsed] = useState<Record<string, boolean>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // hydrate from storage after mount (covers SSR fallback mismatch)
  useEffect(() => {
    setCollapsed(readCollapsedFromStorage(defaultCollapsed));
  }, [defaultCollapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsedToStorage(next);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (item: LabsSidebarItem) => {
      onSelect?.(item.href);
      if (item.children && item.children.length > 0) {
        const id = item.slug.join("/");
        setExpandedIds((prev) => {
          const next = new Set(prev);
          if (!prev.has(id)) next.add(id);
          return next;
        });
      }
    },
    [onSelect]
  );

  const toggleGroup = useCallback((groupId: string) => {
    setGroupCollapsed((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAllForGroup = useCallback(
    (groupId: string) => {
      const group = tree.find((g) => g.id === groupId);
      if (!group) return;
      const ids: string[] = [];
      const walk = (items: LabsSidebarItem[]) => {
        for (const it of items) {
          if (it.children && it.children.length > 0) {
            ids.push(it.slug.join("/"));
            walk(it.children);
          }
        }
      };
      walk(group.items);
      setExpandedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
      setGroupCollapsed((prev) => ({ ...prev, [groupId]: false }));
    },
    [tree]
  );

  const collapseAllForGroup = useCallback(
    (groupId: string) => {
      const group = tree.find((g) => g.id === groupId);
      if (!group) {
        setGroupCollapsed((prev) => ({ ...prev, [groupId]: true }));
        return;
      }
      // collect all descendant ids to remove
      const ids = new Set<string>();
      const walk = (items: LabsSidebarItem[]) => {
        for (const it of items) {
          if (it.children && it.children.length > 0) {
            ids.add(it.slug.join("/"));
            walk(it.children);
          }
        }
      };
      walk(group.items);
      setExpandedIds((prev) => {
        const next = new Set<string>();
        for (const id of prev) if (!ids.has(id)) next.add(id);
        return next;
      });
      // For leaf-only groups, collapsing means hiding the section content
      // For parent groups, also collapse group header
      const hasNested = ids.size > 0;
      if (!hasNested) {
        setGroupCollapsed((prev) => ({ ...prev, [groupId]: true }));
      } else {
        // keep group open but collapse children; if user explicitly wants group closed, second click will do that
        // To match spec "Collapse all" inside section options: if group has children, clear expanded; keep group open
        // We do not auto-collapse group header here unless no children
      }
    },
    [tree]
  );

  const hasTree = useMemo(() => tree.length > 0, [tree]);

  const asideClass = [
    styles.sidebar,
    collapsed ? styles["is-collapsed"] : "",
    collapsed ? "is-collapsed" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (collapsed) {
    return (
      <aside className={asideClass} aria-label="Library navigation" data-collapsed="true">
        <div className={styles.railCollapsed}>
          <button
            type="button"
            className={styles.railCollapsedButton}
            aria-label="Expand sidebar"
            onClick={toggleCollapsed}
            data-testid="labs-sidebar-expand"
          >
            <PanelLeft aria-hidden="true" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={asideClass}
      aria-label="Library navigation"
      data-collapsed="false"
      data-testid="labs-sidebar-root"
    >
      <div className={styles.panel} data-testid="labs-sidebar-panel">
        <header className={styles.brandRow}>
          <button
            type="button"
            className={styles.brandButton}
            aria-label="Collapse sidebar"
            aria-expanded={!collapsed}
            onClick={toggleCollapsed}
            data-testid="labs-sidebar-brand-toggle"
          >
            <span className={styles.brandDot} aria-hidden="true" />
            <span>Library</span>
          </button>
          <button
            type="button"
            className={styles.collapseButton}
            aria-label="Collapse sidebar"
            onClick={toggleCollapsed}
            data-testid="labs-sidebar-collapse"
          >
            <PanelLeft aria-hidden="true" />
          </button>
        </header>

        <div className={styles.scroll}>
          {!hasTree ? (
            <div className={styles.emptyState} role="status">
              No documents yet. Add Markdown files to your library to see them here.
            </div>
          ) : (
            tree.map((group) => {
              const isGroupCollapsed = Boolean(groupCollapsed[group.id]);
              const expandId = `labs-sidebar-group-${group.id}`;
              return (
                <section key={group.id} className={styles.section} aria-labelledby={expandId}>
                  <div className={styles.sectionHeading}>
                    <button
                      type="button"
                      className={styles.sectionTitle}
                      aria-expanded={!isGroupCollapsed}
                      aria-controls={`${expandId}-content`}
                      onClick={() => toggleGroup(group.id)}
                      data-testid={`labs-sidebar-group-toggle-${group.id}`}
                    >
                      <ChevronDown
                        className={isGroupCollapsed ? styles.turned : ""}
                        aria-hidden="true"
                      />
                      <span id={expandId}>{group.label}</span>
                    </button>

                    <details className={styles.sectionOptions}>
                      <summary
                        aria-label={`${group.label} options`}
                        title={`${group.label} options`}
                        data-testid={`labs-sidebar-options-${group.id}`}
                      >
                        <MoreHorizontal aria-hidden="true" />
                      </summary>
                      <div className={styles.sectionOptionsMenu}>
                        <button
                          type="button"
                          onClick={(event) => {
                            expandAllForGroup(group.id);
                            event.currentTarget.closest("details")?.removeAttribute("open");
                          }}
                        >
                          Expand all
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            collapseAllForGroup(group.id);
                            event.currentTarget.closest("details")?.removeAttribute("open");
                          }}
                        >
                          Collapse all
                        </button>
                      </div>
                    </details>

                    <button
                      type="button"
                      className={styles.sectionAdd}
                      aria-label={`Add to ${group.label}`}
                      title={`Add to ${group.label}`}
                      onClick={() => onCreate?.(group.id)}
                      data-testid={`labs-sidebar-add-${group.id}`}
                    >
                      <Plus aria-hidden="true" />
                    </button>
                  </div>

                  {!isGroupCollapsed && (
                    <div id={`${expandId}-content`} className={styles.navList} role="list">
                      {group.items.map((item) => (
                        <LabsSidebarRow
                          key={item.slug.join("/")}
                          item={item}
                          depth={0}
                          selected={selected}
                          expandedIds={expandedIds}
                          onSelect={handleSelect}
                          onToggleExpanded={toggleExpanded}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
}

function LabsSidebarRow({
  item,
  depth,
  selected,
  expandedIds,
  onSelect,
  onToggleExpanded,
}: {
  item: LabsSidebarItem;
  depth: number;
  selected?: string;
  expandedIds: Set<string>;
  onSelect: (item: LabsSidebarItem) => void;
  onToggleExpanded: (id: string) => void;
}) {
  const hasChildren = Boolean(item.children && item.children.length > 0);
  const id = item.slug.join("/");
  const isExpanded = expandedIds.has(id);
  const isSelected = selected === item.href;

  if (hasChildren) {
    return (
      <div className={styles.navigationItem} role="listitem">
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 4 }}>
          <button
            type="button"
            className={[
              styles.navRow,
              isSelected ? styles.selected : "",
              styles.hasAction,
              depth > 0 ? styles.childRow : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={isSelected ? "page" : undefined}
            aria-expanded={isExpanded}
            onClick={() => onSelect(item)}
            data-testid={`labs-sidebar-item-${id}`}
          >
            <span>{item.title}</span>
          </button>
          <button
            type="button"
            className={[styles.disclosure, isExpanded ? styles.disclosureOpen : ""]
              .filter(Boolean)
              .join(" ")}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${item.title}`}
            aria-expanded={isExpanded}
            onClick={() => onToggleExpanded(id)}
            data-testid={`labs-sidebar-disclosure-${id}`}
          >
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
        {isExpanded && item.children && (
          <div className={styles.childList} role="list">
            {item.children.map((child) => (
              <LabsSidebarRow
                key={child.slug.join("/")}
                item={child}
                depth={depth + 1}
                selected={selected}
                expandedIds={expandedIds}
                onSelect={onSelect}
                onToggleExpanded={onToggleExpanded}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.navigationItem} role="listitem">
      <button
        type="button"
        className={[
          styles.navRow,
          isSelected ? styles.selected : "",
          depth > 0 ? styles.childRow : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-current={isSelected ? "page" : undefined}
        onClick={() => onSelect(item)}
        data-testid={`labs-sidebar-item-${id}`}
      >
        <span>{item.title}</span>
      </button>
    </div>
  );
}
