"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Command, PanelLeft, ArchiveX, FolderOpen, BookOpen } from "lucide-react";
import styles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import wsStyles from "@/components/shell/WorkspaceShell.module.css";

function openGlobalCommand() {
  const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
  if (trigger) trigger.click();
}

export default function TrashPanel({ onCollapse }: { onCollapse?: () => void }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const go = useCallback((href: string) => router.push(href), [router]);

  return (
    <div className={wsStyles.panelInner} data-testid="workspace-trash-panel">
      <header className={styles.brandRow}>
        <div className={styles.workspaceSwitch}>
          <button type="button" className={styles.workspaceButton}>
            <span className={styles.gradientMark} aria-hidden="true" />
            <strong>Trash</strong>
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

        <section className={styles.navigationSection} aria-labelledby="ws-trash-info">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((v) => !v)}
            >
              <ChevronDown className={collapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-trash-info">File ownership</span>
            </button>
          </div>
          {!collapsed && (
            <div className={styles.navList} role="list">
              <div className={styles.emptyState}>
                Verto never moves files to a private bin. Use your file system to delete or restore.
              </div>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/integrations")}
                role="listitem"
              >
                <FolderOpen aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>View Sources</span>
              </button>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/library")}
                role="listitem"
              >
                <BookOpen aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>Back to Library</span>
              </button>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/trash")}
                role="listitem"
              >
                <ArchiveX aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.6 }} />
                <span>Trash details</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
