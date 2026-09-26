"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Command, PanelLeft, Folder, Rss, HardDrive } from "lucide-react";
import styles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import wsStyles from "@/components/shell/WorkspaceShell.module.css";

function openGlobalCommand() {
  const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
  if (trigger) trigger.click();
}

export default function IntegrationsPanel({ onCollapse }: { onCollapse?: () => void }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const go = useCallback((href: string) => router.push(href), [router]);

  return (
    <div className={wsStyles.panelInner} data-testid="workspace-integrations-panel">
      <header className={styles.brandRow}>
        <div className={styles.workspaceSwitch}>
          <button type="button" className={styles.workspaceButton}>
            <span className={styles.gradientMark} aria-hidden="true" />
            <strong>Sources</strong>
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

        <section className={styles.navigationSection} aria-labelledby="ws-sources-list">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((v) => !v)}
            >
              <ChevronDown className={collapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-sources-list">Sources</span>
            </button>
          </div>
          {!collapsed && (
            <div className={styles.navList} role="list">
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/integrations")}
                role="listitem"
              >
                <HardDrive aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>Local Library</span>
              </button>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/inbox#subscriptions")}
                role="listitem"
              >
                <Rss aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>RSS feeds</span>
              </button>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/integrations")}
                role="listitem"
              >
                <Folder aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.6 }} />
                <span>Manage sources</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
