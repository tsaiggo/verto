"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Command, PanelLeft, Tag } from "lucide-react";
import { collectTagFacets, type LabsSidebarTree } from "@/lib/sidebar/buildLabsTree";
import styles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import wsStyles from "@/components/shell/WorkspaceShell.module.css";

function openGlobalCommand() {
  const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
  if (trigger) trigger.click();
}

export default function TagsPanel({
  tree,
  onCollapse,
}: {
  tree: LabsSidebarTree;
  onCollapse?: () => void;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const tags = collectTagFacets(tree);
  const go = useCallback((href: string) => router.push(href), [router]);

  return (
    <div className={wsStyles.panelInner} data-testid="workspace-tags-panel">
      <header className={styles.brandRow}>
        <div className={styles.workspaceSwitch}>
          <button type="button" className={styles.workspaceButton}>
            <span className={styles.gradientMark} aria-hidden="true" />
            <strong>Tags</strong>
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

        <section className={styles.navigationSection} aria-labelledby="ws-tags-list">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((v) => !v)}
            >
              <ChevronDown className={collapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-tags-list">All tags</span>
            </button>
          </div>
          {!collapsed && (
            <div className={styles.navList} role="list">
              {tags.length === 0 ? (
                <div className={styles.emptyState}>
                  No tags in this library. Tags from frontmatter will appear here.
                </div>
              ) : (
                tags.map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    className={styles.navRow}
                    onClick={() => go(`/tags`)}
                    role="listitem"
                  >
                    <Tag aria-hidden="true" style={{ width: 16, height: 16 }} />
                    <span>{t.tag}</span>
                    <small>{t.count}</small>
                  </button>
                ))
              )}
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/tags")}
                role="listitem"
              >
                <Tag aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.6 }} />
                <span>Browse tags page</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
