"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Command, PanelLeft, Clock, FileText } from "lucide-react";
import { flattenToList, type LabsSidebarTree } from "@/lib/sidebar/buildLabsTree";
import styles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import wsStyles from "@/components/shell/WorkspaceShell.module.css";

function openGlobalCommand() {
  const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
  if (trigger) trigger.click();
}

export default function RecentPanel({
  tree,
  onCollapse,
}: {
  tree: LabsSidebarTree;
  onCollapse?: () => void;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const recent = useMemo(() => {
    const all = flattenToList(tree).filter((i) => !i.children || i.children.length === 0);
    const sorted = [...all].sort((a, b) => {
      const ad = a.date ? Date.parse(a.date) : 0;
      const bd = b.date ? Date.parse(b.date) : 0;
      if (ad !== bd) return bd - ad;
      return a.title.localeCompare(b.title);
    });
    return sorted.slice(0, 12);
  }, [tree]);

  const go = useCallback((href: string) => router.push(href), [router]);

  return (
    <div className={wsStyles.panelInner} data-testid="workspace-recent-panel">
      <header className={styles.brandRow}>
        <div className={styles.workspaceSwitch}>
          <button type="button" className={styles.workspaceButton}>
            <span className={styles.gradientMark} aria-hidden="true" />
            <strong>Recent</strong>
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

        <section className={styles.navigationSection} aria-labelledby="ws-recent-list">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((v) => !v)}
            >
              <ChevronDown className={collapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-recent-list">Recently updated</span>
            </button>
          </div>
          {!collapsed && (
            <div className={styles.navList} role="list">
              {recent.length === 0 ? (
                <div className={styles.emptyState}>
                  No recent documents. Your latest edits will appear here.
                </div>
              ) : (
                recent.map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    className={styles.navRow}
                    onClick={() => go(item.href)}
                    role="listitem"
                  >
                    <FileText aria-hidden="true" style={{ width: 16, height: 16 }} />
                    <span>{item.title}</span>
                  </button>
                ))
              )}
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/recent")}
                role="listitem"
              >
                <Clock aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.6 }} />
                <span>View all recent</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
