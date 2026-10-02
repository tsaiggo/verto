"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Command, PanelLeft, FileText, Eye, Code2, Save } from "lucide-react";
import styles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import wsStyles from "@/components/shell/WorkspaceShell.module.css";
import { requestAppNavigation } from "@/lib/app-navigation";
import {
  EDITOR_DOCUMENT_EVENT,
  requestEditorAction,
  type EditorDocumentDetail,
} from "@/lib/article-editor-events";
import { SavedPageNavigation } from "@/components/articles/SavedPageNavigation";

function openGlobalCommand() {
  const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
  if (trigger) trigger.click();
}

export default function EditorPanel({ onCollapse }: { onCollapse?: () => void }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [canSave, setCanSave] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const slug = new URLSearchParams(window.location.search).get("slug");
      if (slug) setDraftName(slug.split("/").pop() ?? slug);
    });
    const updateDocument = (event: Event) => {
      const detail = (event as CustomEvent<EditorDocumentDetail>).detail;
      const filename = detail?.filename;
      if (typeof filename === "string") setDraftName(filename);
      setCanSave(detail?.canSave === true);
    };
    window.addEventListener(EDITOR_DOCUMENT_EVENT, updateDocument);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(EDITOR_DOCUMENT_EVENT, updateDocument);
    };
  }, []);

  const go = useCallback(
    (href: string) => {
      if (requestAppNavigation()) router.push(href);
    },
    [router]
  );

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

        <section className={styles.navigationSection} aria-labelledby="ws-editor-doc">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((v) => !v)}
            >
              <ChevronDown className={collapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-editor-doc">Document</span>
            </button>
          </div>
          {!collapsed && (
            <div className={styles.navList} role="group" aria-label="Article actions">
              {draftName ? (
                <div className={styles.emptyState} style={{ paddingTop: 4, paddingBottom: 8 }}>
                  Editing: {draftName}
                </div>
              ) : (
                <div className={styles.emptyState} style={{ paddingTop: 4, paddingBottom: 8 }}>
                  New draft. Use the editor to write Markdown/MDX.
                </div>
              )}
              <button
                type="button"
                className={styles.navRow}
                onClick={() => requestEditorAction("source")}
                aria-label="Show source"
              >
                <Code2 aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>Source</span>
              </button>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => requestEditorAction("preview")}
                aria-label="Show preview"
              >
                <Eye aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>Preview</span>
              </button>
              <button type="button" className={styles.navRow} onClick={() => go("/library")}>
                <FileText aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>Back to Library</span>
              </button>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => requestEditorAction("save")}
                disabled={!canSave}
              >
                <Save aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.6 }} />
                <span>Save article</span>
              </button>
            </div>
          )}
        </section>
        <Suspense fallback={null}>
          <SavedPageNavigation mode="edit" />
        </Suspense>
      </div>
    </div>
  );
}
