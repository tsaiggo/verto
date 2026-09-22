"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Command, PanelLeft, FileText, Eye, Code2, Save } from "lucide-react";
import styles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import wsStyles from "@/components/shell/WorkspaceShell.module.css";

function openGlobalCommand() {
  const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
  if (trigger) trigger.click();
}

export default function EditorPanel({ onCollapse }: { onCollapse?: () => void }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [draftName, setDraftName] = useState<string | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const slug = new URLSearchParams(window.location.search).get("slug");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate query param after mount
      if (slug) setDraftName(slug.split("/").pop() ?? slug);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const go = useCallback((href: string) => router.push(href), [router]);

  return (
    <div className={wsStyles.panelInner} data-testid="workspace-editor-panel">
      <header className={styles.brandRow}>
        <div className={styles.workspaceSwitch}>
          <button type="button" className={styles.workspaceButton}>
            <span className={styles.gradientMark} aria-hidden="true" />
            <strong>Editor</strong>
            <ChevronDown size={13} aria-hidden="true" />
          </button>
        </div>
        <button type="button" className={styles.smallButton} aria-label="Collapse sidebar" onClick={onCollapse} data-testid="workspace-panel-collapse">
          <PanelLeft aria-hidden="true" />
        </button>
      </header>

      <div className={styles.navigationScroll}>
        <div className={styles.primaryNavigation}>
          <button type="button" className={styles.commandButton} onClick={openGlobalCommand} aria-label="Open command palette">
            <Command aria-hidden="true" />
            <span>Command</span>
            <kbd>⌘ K</kbd>
          </button>
        </div>

        <section className={styles.navigationSection} aria-labelledby="ws-editor-doc">
          <div className={styles.sectionHeading}>
            <button type="button" className={styles.sectionTitle} aria-expanded={!collapsed} onClick={() => setCollapsed((v) => !v)}>
              <ChevronDown className={collapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-editor-doc">Document</span>
            </button>
          </div>
          {!collapsed && (
            <div className={styles.navList} role="list">
              {draftName ? (
                <div className={styles.emptyState} style={{ paddingTop: 4, paddingBottom: 8 }}>
                  Editing: {draftName}
                </div>
              ) : (
                <div className={styles.emptyState} style={{ paddingTop: 4, paddingBottom: 8 }}>
                  New draft. Use the editor to write Markdown/MDX.
                </div>
              )}
              <button type="button" className={styles.navRow} onClick={() => go("/editor")} role="listitem">
                <Code2 aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>Source</span>
              </button>
              <button type="button" className={styles.navRow} onClick={() => go("/editor")} role="listitem">
                <Eye aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>Preview</span>
              </button>
              <button type="button" className={styles.navRow} onClick={() => go("/library")} role="listitem">
                <FileText aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>Back to Library</span>
              </button>
              <button type="button" className={styles.navRow} onClick={() => go("/editor")} role="listitem">
                <Save aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.6 }} />
                <span>Save / Download</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
