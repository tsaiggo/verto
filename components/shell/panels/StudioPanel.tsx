"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Command, PanelLeft, FileText, StickyNote, Layers } from "lucide-react";
import { getStateStore } from "@/lib/state-store";
import { buildStudioArtifacts } from "@/components/studio/studio-artifacts";
import styles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import wsStyles from "@/components/shell/WorkspaceShell.module.css";

function openGlobalCommand() {
  const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
  if (trigger) trigger.click();
}

function subscribe(cb: () => void): () => void {
  return getStateStore().subscribe(cb);
}
function getSnapshot(): string {
  const s = getStateStore();
  return JSON.stringify({
    summaries: s.read<unknown>("summaries", { summaries: [] }),
    annotations: s.read<unknown>("annotations", { annotations: [] }),
  });
}
function getServerSnapshot(): string {
  return JSON.stringify({ summaries: { summaries: [] }, annotations: { annotations: [] } });
}

export default function StudioPanel({ onCollapse }: { onCollapse?: () => void }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getStateStore().hydrate?.("summaries"), getStateStore().hydrate?.("annotations")])
      .catch(() => {})
      .finally(() => {
        if (active) setHydrated(true);
      });
    const t = setTimeout(() => {
      if (active) setHydrated(true);
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, []);

  let summaryCount = 0;
  let noteCount = 0;
  const artifacts: ReturnType<typeof buildStudioArtifacts> = (() => {
    try {
      const parsed = JSON.parse(snapshot) as {
        summaries: { summaries?: unknown[] } | unknown[] | null;
        annotations: { annotations?: unknown[] } | unknown[] | null;
      };
      const summariesRaw = Array.isArray(parsed.summaries)
        ? parsed.summaries
        : Array.isArray((parsed.summaries as { summaries?: unknown })?.summaries)
          ? ((parsed.summaries as { summaries: unknown[] }).summaries as unknown[])
          : [];
      const annotationsRaw = Array.isArray(parsed.annotations)
        ? parsed.annotations
        : Array.isArray((parsed.annotations as { annotations?: unknown })?.annotations)
          ? ((parsed.annotations as { annotations: unknown[] }).annotations as unknown[])
          : [];
      // Normalize via safe fallback: attempt to use buildStudioArtifacts directly with raw; it expects SavedSummary[] / Annotation[]
      // Use JSON snapshot but fallback to 0 if shape wrong
      const maybe = (() => {
        try {
          // Try reading via store normalized already
          const sSummaries =
            (
              JSON.parse(
                JSON.stringify(getStateStore().read<unknown>("summaries", { summaries: [] }))
              ) as { summaries: unknown[] }
            ).summaries ?? [];
          const sAnnos =
            (
              JSON.parse(
                JSON.stringify(getStateStore().read<unknown>("annotations", { annotations: [] }))
              ) as { annotations: unknown[] }
            ).annotations ?? [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return buildStudioArtifacts(sSummaries as any, sAnnos as any);
        } catch {
          return [];
        }
      })();
      // Also attempt with parsed if store failed
      const art =
        maybe.length > 0
          ? maybe
          : (() => {
              try {
                return buildStudioArtifacts(summariesRaw as never, annotationsRaw as never);
              } catch {
                return [];
              }
            })();
      return art;
    } catch {
      return [];
    }
  })();
  summaryCount = artifacts.filter((a) => a.kind === "summary").length;
  noteCount = artifacts.filter((a) => a.kind === "note").length;

  const go = useCallback((href: string) => router.push(href), [router]);

  return (
    <div className={wsStyles.panelInner} data-testid="workspace-studio-panel">
      <header className={styles.brandRow}>
        <div className={styles.workspaceSwitch}>
          <button type="button" className={styles.workspaceButton}>
            <span className={styles.gradientMark} aria-hidden="true" />
            <strong>Studio</strong>
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

        <section className={styles.navigationSection} aria-labelledby="ws-studio-views">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((v) => !v)}
            >
              <ChevronDown className={collapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-studio-views">Views</span>
            </button>
          </div>
          {!collapsed && (
            <div className={styles.navList} role="list">
              {!hydrated && artifacts.length === 0 ? (
                <div className={styles.emptyState}>Loading Studio…</div>
              ) : null}
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/studio")}
                role="listitem"
              >
                <Layers aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>All insights</span>
                {artifacts.length > 0 ? <small>{artifacts.length}</small> : null}
              </button>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/studio")}
                role="listitem"
              >
                <FileText aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>Summaries</span>
                {summaryCount > 0 ? <small>{summaryCount}</small> : null}
              </button>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/studio")}
                role="listitem"
              >
                <StickyNote aria-hidden="true" style={{ width: 16, height: 16 }} />
                <span>Notes</span>
                {noteCount > 0 ? <small>{noteCount}</small> : null}
              </button>
              {hydrated && artifacts.length === 0 ? (
                <div className={styles.emptyState}>
                  No insights yet. Save a summary or note while reading.
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
