"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Command, FileText, Folder, PanelLeft, Compass } from "lucide-react";
import type { LabsSidebarTree, LabsSidebarItem } from "@/lib/sidebar/buildLabsTree";
import styles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import wsStyles from "@/components/shell/WorkspaceShell.module.css";

function openGlobalCommand() {
  const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
  if (trigger) trigger.click();
}

export default function HelpPanel({
  tree,
  onCollapse,
}: {
  tree: LabsSidebarTree;
  onCollapse?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [collapsed, setCollapsed] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const selected = pathname.startsWith("/help") ? pathname : undefined;

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const go = useCallback((href: string) => router.push(href), [router]);

  return (
    <div className={wsStyles.panelInner} data-testid="workspace-help-panel">
      <header className={styles.brandRow}>
        <div className={styles.workspaceSwitch}>
          <button type="button" className={styles.workspaceButton}>
            <span className={styles.gradientMark} aria-hidden="true" />
            <strong>Help</strong>
            <ChevronDown size={13} aria-hidden="true" />
          </button>
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

        <section className={styles.navigationSection} aria-labelledby="ws-help-tree">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((v) => !v)}
            >
              <ChevronDown className={collapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-help-tree">Guides</span>
            </button>
          </div>
          {!collapsed && (
            <div className={styles.navList} role="list">
              {tree.length === 0 ? (
                <div className={styles.emptyState}>No Help pages found.</div>
              ) : (
                tree.map((group) => {
                  const groupId = group.id;
                  const isGroupExpanded = expandedIds.has(groupId) || group.items.length <= 8;
                  return (
                    <div key={group.id} className={styles.navigationItem} role="listitem">
                      <div className={styles.projectHeading}>
                        <button
                          type="button"
                          className={styles.navRow}
                          onClick={() => go(group.href)}
                          aria-expanded={isGroupExpanded}
                        >
                          <span className={styles.projectTile} aria-hidden="true">
                            <Folder aria-hidden="true" />
                          </span>
                          <span>{group.label}</span>
                        </button>
                        {group.items.length > 1 && (
                          <button
                            type="button"
                            className={[
                              styles.disclosure,
                              isGroupExpanded ? styles.disclosureOpen : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            aria-label={`${isGroupExpanded ? "Collapse" : "Expand"} ${group.label}`}
                            aria-expanded={isGroupExpanded}
                            onClick={() => toggleExpanded(groupId)}
                          >
                            <ChevronDown aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      {isGroupExpanded && (
                        <div className={styles.childList} role="list">
                          {group.items.map((item) => (
                            <HelpRow
                              key={item.slug.join("/")}
                              item={item}
                              depth={1}
                              selected={selected}
                              expandedIds={expandedIds}
                              onSelect={go}
                              onToggle={toggleExpanded}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/help")}
                role="listitem"
              >
                <Compass aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.6 }} />
                <span>Help index</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function HelpRow({
  item,
  depth,
  selected,
  expandedIds,
  onSelect,
  onToggle,
}: {
  item: LabsSidebarItem;
  depth: number;
  selected?: string;
  expandedIds: Set<string>;
  onSelect: (href: string) => void;
  onToggle: (id: string) => void;
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
            onClick={() => onSelect(item.href)}
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
            onClick={() => onToggle(id)}
          >
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
        {isExpanded && item.children && (
          <div className={styles.childList} role="list">
            {item.children.map((child) => (
              <HelpRow
                key={child.slug.join("/")}
                item={child}
                depth={depth + 1}
                selected={selected}
                expandedIds={expandedIds}
                onSelect={onSelect}
                onToggle={onToggle}
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
        onClick={() => onSelect(item.href)}
      >
        <FileText aria-hidden="true" style={{ width: 16, height: 16 }} />
        <span>{item.title}</span>
      </button>
    </div>
  );
}
