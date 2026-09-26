"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Command, PanelLeft, Folder, Layers } from "lucide-react";
import { getStateStore } from "@/lib/state-store";
import type { Collection } from "@/lib/collections";
import styles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import wsStyles from "@/components/shell/WorkspaceShell.module.css";

function openGlobalCommand() {
  const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
  if (trigger) trigger.click();
}

function subscribeCollections(cb: () => void): () => void {
  return getStateStore().subscribe(cb);
}
function getSnapshot(): string {
  return JSON.stringify(getStateStore().read<unknown>("collections", []));
}
function getServerSnapshot(): string {
  return JSON.stringify([]);
}

function normalizeCollections(value: unknown): Collection[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is Collection =>
      typeof v === "object" &&
      v !== null &&
      typeof (v as Collection).id === "string" &&
      typeof (v as Collection).name === "string"
  ) as Collection[];
}

export default function CollectionsPanel({ onCollapse }: { onCollapse?: () => void }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const snapshot = useSyncExternalStore(subscribeCollections, getSnapshot, getServerSnapshot);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    const store = getStateStore();
    store.hydrate?.("collections").finally(() => {
      if (active) setHydrated(true);
    });
    // also set hydrated quickly if no hydrate method or already done
    const t = setTimeout(() => {
      if (active) setHydrated(true);
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, []);

  const collections = (() => {
    try {
      const raw = JSON.parse(snapshot) as unknown;
      return normalizeCollections(raw);
    } catch {
      return [];
    }
  })();

  const go = useCallback((href: string) => router.push(href), [router]);

  return (
    <div className={wsStyles.panelInner} data-testid="workspace-collections-panel">
      <header className={styles.brandRow}>
        <div className={styles.workspaceSwitch}>
          <button type="button" className={styles.workspaceButton}>
            <span className={styles.gradientMark} aria-hidden="true" />
            <strong>Collections</strong>
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

        <section className={styles.navigationSection} aria-labelledby="ws-collections-list">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((v) => !v)}
            >
              <ChevronDown className={collapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-collections-list">Your collections</span>
            </button>
          </div>
          {!collapsed && (
            <div className={styles.navList} role="list">
              {!hydrated && collections.length === 0 ? (
                <div className={styles.emptyState}>Loading collections…</div>
              ) : collections.length === 0 ? (
                <div className={styles.emptyState}>
                  No collections yet. Create one on the Collections page.
                </div>
              ) : (
                collections.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={styles.navRow}
                    onClick={() => go("/collections")}
                    role="listitem"
                  >
                    <Folder aria-hidden="true" style={{ width: 16, height: 16 }} />
                    <span>{c.name}</span>
                    <small>{c.docHrefs.length}</small>
                  </button>
                ))
              )}
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/collections")}
                role="listitem"
              >
                <Layers aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.6 }} />
                <span>Manage collections</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
