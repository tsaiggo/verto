"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Command, FileText, Folder, MoreHorizontal, PanelLeft } from "lucide-react";
import type { LabsSidebarItem, LabsSidebarTree } from "@/lib/sidebar/buildLabsTree";
import { selectedAncestorIds } from "@/lib/sidebar/selection";
import styles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import wsStyles from "@/components/shell/WorkspaceShell.module.css";
import { SavedPageNavigation } from "@/components/articles/SavedPageNavigation";
import { requestAppNavigation } from "@/lib/app-navigation";

export interface LibraryPanelProps {
  tree: LabsSidebarTree;
  onCollapse?: () => void;
}

// eslint-disable-next-line max-lines-per-function -- library panel reuses AdaptedWorkspaceSidebar group/expand logic verbatim
export default function LibraryPanel({ tree, onCollapse }: LibraryPanelProps) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [groupCollapsed, setGroupCollapsed] = useState<Record<string, boolean>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [workspaceMenu, setWorkspaceMenu] = useState(false);

  useEffect(() => {
    const ancestors = selectedAncestorIds(tree, pathname);
    if (ancestors.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reveal the current document in the navigation tree
    setExpandedIds((previous) => {
      if (ancestors.every((id) => previous.has(id))) return previous;
      return new Set([...previous, ...ancestors]);
    });
  }, [tree, pathname]);

  // selected href derived from pathname for /read/* highlighting
  const selected = useMemo(() => {
    if (pathname.startsWith("/read") || pathname.startsWith("/library")) return pathname;
    return undefined;
  }, [pathname]);

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
      if (!hasNested) setGroupCollapsed((prev) => ({ ...prev, [groupId]: true }));
    },
    [tree]
  );

  const handleSelect = useCallback(
    (item: LabsSidebarItem) => {
      if (!requestAppNavigation()) return;
      router.push(item.href);
      if (item.children && item.children.length > 0) {
        const id = item.slug.join("/");
        setExpandedIds((prev) => {
          const next = new Set(prev);
          if (!prev.has(id)) next.add(id);
          return next;
        });
      }
    },
    [router]
  );

  const openGlobalCommand = useCallback(() => {
    const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
    if (trigger) trigger.click();
  }, []);

  const hasTree = tree.length > 0;

  return (
    <div className={wsStyles.panelInner} data-testid="workspace-library-panel">
      <header className={styles.brandRow}>
        <div className={styles.workspaceSwitch}>
          <button
            type="button"
            className={styles.workspaceButton}
            onClick={() => setWorkspaceMenu((v) => !v)}
            aria-expanded={workspaceMenu}
            aria-haspopup="menu"
          >
            <span className={styles.gradientMark} aria-hidden="true" />
            <strong>Library</strong>
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          {workspaceMenu && (
            <div className={styles.workspaceMenu} role="menu">
              <span>YOUR WORKSPACE</span>
              <button type="button" role="menuitem" onClick={() => setWorkspaceMenu(false)}>
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
          onClick={onCollapse}
          data-testid="workspace-panel-collapse"
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

        <Suspense fallback={null}>
          <SavedPageNavigation />
        </Suspense>

        {!hasTree ? (
          <div className={styles.emptyState} role="status">
            No documents yet. Add Markdown files to your library to see them here.
          </div>
        ) : (
          tree.map((group) => {
            const isGroupCollapsed = Boolean(groupCollapsed[group.id]);
            const expandId = `ws-lib-${group.id}`;
            const groupLabel =
              group.label.toUpperCase() === "WORKSPACE" ? "DOCUMENTS" : group.label;
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
                  >
                    <ChevronDown
                      className={isGroupCollapsed ? styles.turned : ""}
                      aria-hidden="true"
                    />
                    <span id={expandId}>{groupLabel}</span>
                  </button>

                  <details className={styles.sectionOptions}>
                    <summary aria-label={`${groupLabel} options`} title={`${groupLabel} options`}>
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
                </div>

                {!isGroupCollapsed && (
                  <div id={`${expandId}-content`} className={styles.navList} role="list">
                    {group.items.map((item) => (
                      <LibraryRow
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
  );
}

function LibraryRow({
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
          >
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
        {isExpanded && item.children && (
          <div className={styles.childList} role="list">
            {item.children.map((child) => (
              <LibraryRow
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
      >
        <FileText aria-hidden="true" style={{ width: 16, height: 16 }} />
        <span>{item.title}</span>
      </button>
    </div>
  );
}
