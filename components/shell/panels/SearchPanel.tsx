"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Command, PanelLeft, Search, Lightbulb, Clock } from "lucide-react";
import styles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import wsStyles from "@/components/shell/WorkspaceShell.module.css";

function openGlobalCommand() {
  const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
  if (trigger) trigger.click();
}

export default function SearchPanel({ onCollapse }: { onCollapse?: () => void }) {
  const router = useRouter();
  const [tipsCollapsed, setTipsCollapsed] = useState(false);
  const [scopesCollapsed, setScopesCollapsed] = useState(false);
  const go = useCallback((href: string) => router.push(href), [router]);

  // No persisted saved-searches concept in this codebase; honest minimal panel.
  // Recent queries are not persisted either — avoid fake data.

  return (
    <div className={wsStyles.panelInner} data-testid="workspace-search-panel">
      <header className={styles.brandRow}>
        <div className={styles.workspaceSwitch}>
          <button type="button" className={styles.workspaceButton}>
            <span className={styles.gradientMark} aria-hidden="true" />
            <strong>Search</strong>
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

        <section className={styles.navigationSection} aria-labelledby="ws-search-scopes">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!scopesCollapsed}
              onClick={() => setScopesCollapsed((v) => !v)}
            >
              <ChevronDown className={scopesCollapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-search-scopes">Search scopes</span>
            </button>
          </div>
          {!scopesCollapsed && (
            <div className={styles.navList} role="list">
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/search")}
                role="listitem"
              >
                <Search aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>All pages</span>
              </button>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/search")}
                role="listitem"
              >
                <Search aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>Headings</span>
              </button>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/search")}
                role="listitem"
              >
                <Search aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>Code blocks</span>
              </button>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/search")}
                role="listitem"
              >
                <Search aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>Folders</span>
              </button>
            </div>
          )}
        </section>

        <section className={styles.navigationSection} aria-labelledby="ws-search-tips">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!tipsCollapsed}
              onClick={() => setTipsCollapsed((v) => !v)}
            >
              <ChevronDown className={tipsCollapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-search-tips">Tips</span>
            </button>
          </div>
          {!tipsCollapsed && (
            <div className={styles.navList} role="list">
              <div className={styles.emptyState} role="note" style={{ paddingBottom: 8 }}>
                Search is grounded in your library. Try keywords from headings or code.
              </div>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/search")}
                role="listitem"
              >
                <Lightbulb aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>Open search</span>
              </button>
              <button
                type="button"
                className={styles.navRow}
                onClick={openGlobalCommand}
                role="listitem"
              >
                <Clock aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.6 }} />
                <span>Use ⌘K for quick jump</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
