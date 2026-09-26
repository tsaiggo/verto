"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Command, PanelLeft, Sparkles, Folder, Bot } from "lucide-react";
import styles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import wsStyles from "@/components/shell/WorkspaceShell.module.css";

function openGlobalCommand() {
  const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
  if (trigger) trigger.click();
}

export default function OnboardingPanel({ onCollapse }: { onCollapse?: () => void }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const go = useCallback((href: string) => router.push(href), [router]);

  return (
    <div className={wsStyles.panelInner} data-testid="workspace-onboarding-panel">
      <header className={styles.brandRow}>
        <div className={styles.workspaceSwitch}>
          <button type="button" className={styles.workspaceButton}>
            <span className={styles.gradientMark} aria-hidden="true" />
            <strong>Welcome</strong>
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

        <section className={styles.navigationSection} aria-labelledby="ws-onboarding-steps">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((v) => !v)}
            >
              <ChevronDown className={collapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-onboarding-steps">Setup</span>
            </button>
          </div>
          {!collapsed && (
            <div className={styles.navList} role="list">
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/onboarding")}
                role="listitem"
              >
                <Sparkles aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>Welcome</span>
              </button>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/onboarding/source")}
                role="listitem"
              >
                <Folder aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>Choose a folder</span>
              </button>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/onboarding/ai")}
                role="listitem"
              >
                <Bot aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>Optional AI</span>
              </button>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/integrations")}
                role="listitem"
              >
                <Folder aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.6 }} />
                <span>Sources</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
