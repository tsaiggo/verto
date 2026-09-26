"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Command, PanelLeft, Home, Clock, Folder } from "lucide-react";
import type { LabsSidebarTree } from "@/lib/sidebar/buildLabsTree";
import { flattenToList } from "@/lib/sidebar/buildLabsTree";
import styles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import wsStyles from "@/components/shell/WorkspaceShell.module.css";

function openGlobalCommand() {
  const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
  if (trigger) trigger.click();
}

export default function HomePanel({
  tree,
  onCollapse,
}: {
  tree: LabsSidebarTree;
  onCollapse?: () => void;
}) {
  const router = useRouter();
  const [sectionsCollapsed, setSectionsCollapsed] = useState(false);
  const [recentCollapsed, setRecentCollapsed] = useState(false);

  const sections = useMemo(() => tree, [tree]);
  const recentDocs = useMemo(() => {
    const all = flattenToList(tree);
    // Sort by date desc where available; fallback to title
    const withDate = [...all].sort((a, b) => {
      const ad = a.date ? Date.parse(a.date) : 0;
      const bd = b.date ? Date.parse(b.date) : 0;
      if (ad !== bd) return bd - ad;
      return a.title.localeCompare(b.title);
    });
    return withDate.slice(0, 6);
  }, [tree]);

  const go = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  const totalDocs = flattenToList(tree).filter(
    (i) => !i.children || i.children.length === 0
  ).length;

  return (
    <div className={wsStyles.panelInner} data-testid="workspace-home-panel">
      <header className={styles.brandRow}>
        <div className={styles.workspaceSwitch}>
          <button type="button" className={styles.workspaceButton} aria-haspopup="menu">
            <span className={styles.gradientMark} aria-hidden="true" />
            <strong>Home</strong>
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

        {/* Sections */}
        <section className={styles.navigationSection} aria-labelledby="ws-home-sections">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!sectionsCollapsed}
              onClick={() => setSectionsCollapsed((v) => !v)}
            >
              <ChevronDown className={sectionsCollapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-home-sections">Sections</span>
            </button>
          </div>
          {!sectionsCollapsed && (
            <div className={styles.navList} role="list">
              {sections.length === 0 ? (
                <div className={styles.emptyState}>
                  No sections yet. Add Markdown files to your library.
                </div>
              ) : (
                sections.map((g) => {
                  const count = (() => {
                    let c = 0;
                    const stack = [...g.items];
                    while (stack.length) {
                      const cur = stack.pop()!;
                      if (cur.children && cur.children.length > 0) stack.push(...cur.children);
                      else c += 1;
                    }
                    return c;
                  })();
                  return (
                    <button
                      key={g.id}
                      type="button"
                      className={styles.navRow}
                      onClick={() => go(g.href)}
                      role="listitem"
                    >
                      <span className={styles.projectTile} aria-hidden="true">
                        <Folder aria-hidden="true" />
                      </span>
                      <span>{g.label}</span>
                      <small>{count}</small>
                    </button>
                  );
                })
              )}
              {sections.length > 0 && (
                <button
                  type="button"
                  className={styles.navRow}
                  onClick={() => go("/library")}
                  role="listitem"
                >
                  <Home aria-hidden="true" style={{ width: 16, height: 16 }} />
                  <span>All documents</span>
                  <small>{totalDocs}</small>
                </button>
              )}
            </div>
          )}
        </section>

        {/* Recent */}
        <section className={styles.navigationSection} aria-labelledby="ws-home-recent">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!recentCollapsed}
              onClick={() => setRecentCollapsed((v) => !v)}
            >
              <ChevronDown className={recentCollapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-home-recent">Recent</span>
            </button>
          </div>
          {!recentCollapsed && (
            <div className={styles.navList} role="list">
              {recentDocs.length === 0 ? (
                <div className={styles.emptyState}>
                  No recent documents. Your latest edits will appear here.
                </div>
              ) : (
                recentDocs.map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    className={styles.navRow}
                    onClick={() => go(item.href)}
                    role="listitem"
                  >
                    <Clock aria-hidden="true" style={{ width: 16, height: 16 }} />
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
                <Clock aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.7 }} />
                <span>View all recent</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
