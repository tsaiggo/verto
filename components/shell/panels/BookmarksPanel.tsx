"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Command, PanelLeft, Bookmark, FileText, StickyNote } from "lucide-react";
import { getStateStore } from "@/lib/state-store";
import type { Bookmark as BM } from "@/lib/bookmarks";
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
  return JSON.stringify(getStateStore().read<unknown>("bookmarks", []));
}
function getServerSnapshot(): string {
  return JSON.stringify([]);
}

export default function BookmarksPanel({ onCollapse }: { onCollapse?: () => void }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    getStateStore()
      .hydrate?.("bookmarks")
      .finally(() => {
        if (active) setHydrated(true);
      });
    const t = setTimeout(() => {
      if (active) setHydrated(true);
    }, 300);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, []);

  let bookmarks: BM[] = [];
  try {
    const raw = JSON.parse(snapshot) as unknown;
    if (Array.isArray(raw)) {
      bookmarks = raw.filter(
        (v): v is BM =>
          typeof v === "object" &&
          v !== null &&
          typeof (v as BM).href === "string" &&
          typeof (v as BM).title === "string"
      ) as BM[];
    }
  } catch {
    bookmarks = [];
  }

  const documents = bookmarks.filter((b) => b.kind !== "note");
  const notes = bookmarks.filter((b) => b.kind === "note");

  const go = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  return (
    <div className={wsStyles.panelInner} data-testid="workspace-bookmarks-panel">
      <header className={styles.brandRow}>
        <div className={styles.workspaceSwitch}>
          <button type="button" className={styles.workspaceButton}>
            <span className={styles.gradientMark} aria-hidden="true" />
            <strong>Bookmarks</strong>
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

        <section className={styles.navigationSection} aria-labelledby="ws-bookmarks-docs">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((v) => !v)}
            >
              <ChevronDown className={collapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-bookmarks-docs">Saved</span>
            </button>
          </div>
          {!collapsed && (
            <div className={styles.navList} role="list">
              {!hydrated && bookmarks.length === 0 ? (
                <div className={styles.emptyState}>Loading bookmarks…</div>
              ) : bookmarks.length === 0 ? (
                <div className={styles.emptyState}>
                  No bookmarks yet. Bookmark a document while reading.
                </div>
              ) : (
                <>
                  {documents.length > 0 &&
                    documents.map((b) => (
                      <button
                        key={b.href}
                        type="button"
                        className={styles.navRow}
                        onClick={() => go(b.href)}
                        role="listitem"
                      >
                        <FileText aria-hidden="true" style={{ width: 16, height: 16 }} />
                        <span>{b.title}</span>
                      </button>
                    ))}
                  {notes.length > 0 &&
                    notes.map((b) => (
                      <button
                        key={b.href}
                        type="button"
                        className={styles.navRow}
                        onClick={() => go(b.href)}
                        role="listitem"
                      >
                        <StickyNote aria-hidden="true" style={{ width: 16, height: 16 }} />
                        <span>{b.title}</span>
                      </button>
                    ))}
                  {documents.length === 0 && notes.length === 0 ? null : null}
                </>
              )}
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/bookmarks")}
                role="listitem"
              >
                <Bookmark aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.6 }} />
                <span>Manage bookmarks</span>
                {bookmarks.length > 0 ? <small>{bookmarks.length}</small> : null}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
