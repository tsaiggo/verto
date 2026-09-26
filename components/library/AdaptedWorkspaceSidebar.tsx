"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Command,
  FileText,
  Folder,
  MoreHorizontal,
  PanelLeft,
  Plus,
} from "lucide-react";
import type { LabsSidebarItem, LabsSidebarTree } from "@/lib/sidebar/buildLabsTree";
import styles from "./AdaptedWorkspaceSidebar.module.css";

export const LABS_SIDEBAR_COLLAPSED_KEY = "verto:labs-sidebar:collapsed";

export interface AdaptedWorkspaceSidebarProps {
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

export default function AdaptedWorkspaceSidebar({
  tree,
  selected,
  onSelect,
  onCreate,
  className,
  defaultCollapsed = false,
}: AdaptedWorkspaceSidebarProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    readCollapsedFromStorage(defaultCollapsed)
  );
  const [groupCollapsed, setGroupCollapsed] = useState<Record<string, boolean>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [workspaceMenu, setWorkspaceMenu] = useState(false);

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
      const hasNested = ids.size > 0;
      if (!hasNested) {
        setGroupCollapsed((prev) => ({ ...prev, [groupId]: true }));
      }
    },
    [tree]
  );

  const hasTree = useMemo(() => tree.length > 0, [tree]);

  const openGlobalCommand = useCallback(() => {
    const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
    if (trigger) {
      trigger.click();
      return;
    }
    // Fallback: synthesize CmdK if trigger not visible (should be visible on /library)
    const event = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
    window.dispatchEvent(event);
  }, []);

  const asideClass = [styles.root, collapsed ? styles["is-collapsed"] : "", className]
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
          <div className={styles.workspaceSwitch}>
            <button
              type="button"
              className={styles.workspaceButton}
              onClick={() => setWorkspaceMenu((v) => !v)}
              aria-expanded={workspaceMenu}
              aria-haspopup="menu"
              data-testid="workspace-switcher-trigger"
            >
              <span className={styles.gradientMark} aria-hidden="true" />
              <strong>Library</strong>
              <ChevronDown size={13} aria-hidden="true" />
            </button>
            {workspaceMenu && (
              <div
                className={styles.workspaceMenu}
                role="menu"
                data-testid="workspace-switcher-menu"
              >
                <span>YOUR WORKSPACE</span>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setWorkspaceMenu(false)}
                  data-testid="workspace-switcher-item"
                >
                  <span
                    className={styles.gradientMark}
                    aria-hidden="true"
                    style={{ width: 18, height: 18 }}
                  />
                  Library <span className={styles.currentDot} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className={styles.smallButton}
            aria-label="Collapse sidebar"
            onClick={toggleCollapsed}
            data-testid="labs-sidebar-collapse"
          >
            <PanelLeft aria-hidden="true" />
          </button>
        </header>

        <div className={styles.navigationScroll}>
          <div className={styles.primaryNavigation}>
            <button
              type="button"
              className={styles.commandButton}
              onClick={openGlobalCommand}
              aria-label="Open command palette"
            >
              <Command aria-hidden="true" />
              <span>Command</span>
              <kbd>⌘ K</kbd>
            </button>
          </div>

          {!hasTree ? (
            <div className={styles.emptyState} role="status">
              No documents yet. Add Markdown files to your library to see them here.
            </div>
          ) : (
            tree.map((group) => {
              const isGroupCollapsed = Boolean(groupCollapsed[group.id]);
              const expandId = `adapted-group-${group.id}`;
              return (
                <section
                  key={group.id}
                  className={styles.navigationSection}
                  aria-labelledby={expandId}
                >
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
                        <AdaptedRow
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

function AdaptedRow({
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
  onSelect: (it: LabsSidebarItem) => void;
  onToggleExpanded: (id: string) => void;
}) {
  const hasChildren = Boolean(item.children && item.children.length > 0);
  const id = item.slug.join("/");
  const isExpanded = expandedIds.has(id);
  const isSelected = selected === item.href;
  const Icon = hasChildren ? Folder : FileText;

  if (hasChildren) {
    return (
      <div className={styles.navigationItem} role="listitem">
        <div className={styles.projectHeading}>
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
            aria-expanded={isExpanded}
            onClick={() => onSelect(item)}
            data-testid={`labs-sidebar-item-${id}`}
          >
            <span className={styles.projectTile} aria-hidden="true">
              <Icon aria-hidden="true" />
            </span>
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
              <AdaptedRow
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
        <FileText aria-hidden="true" style={{ width: 16, height: 16 }} />
        <span>{item.title}</span>
      </button>
    </div>
  );
}
