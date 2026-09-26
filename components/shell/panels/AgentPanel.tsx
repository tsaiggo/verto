"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Command, PanelLeft, Bot, MessageCircle, Clock } from "lucide-react";
import { getStateStore } from "@/lib/state-store";
import type { AgentThreadData } from "@/lib/agent-threads";
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
  return JSON.stringify(getStateStore().read<unknown>("agent-threads", { threads: [] }));
}
function getServerSnapshot(): string {
  return JSON.stringify({ threads: [] });
}

function normalizeThreads(value: unknown): AgentThreadData[] {
  if (typeof value !== "object" || value === null) return [];
  const v = value as { threads?: unknown };
  if (!Array.isArray(v.threads)) return [];
  return v.threads.filter(
    (t): t is AgentThreadData =>
      typeof t === "object" && t !== null && typeof (t as AgentThreadData).id === "string"
  ) as AgentThreadData[];
}

export default function AgentPanel({ onCollapse }: { onCollapse?: () => void }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    getStateStore()
      .hydrate?.("agent-threads")
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

  let threads: AgentThreadData[] = [];
  try {
    threads = normalizeThreads(JSON.parse(snapshot) as unknown);
  } catch {
    threads = [];
  }

  const go = useCallback((href: string) => router.push(href), [router]);

  // Group by recency for display (honest grouping)
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className={wsStyles.panelInner} data-testid="workspace-agent-panel">
      <header className={styles.brandRow}>
        <div className={styles.workspaceSwitch}>
          <button type="button" className={styles.workspaceButton}>
            <span className={styles.gradientMark} aria-hidden="true" />
            <strong>Agent</strong>
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

        <section className={styles.navigationSection} aria-labelledby="ws-agent-threads">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((v) => !v)}
            >
              <ChevronDown className={collapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-agent-threads">Threads</span>
            </button>
          </div>
          {!collapsed && (
            <div className={styles.navList} role="list">
              {!hydrated && threads.length === 0 ? (
                <div className={styles.emptyState}>Loading threads…</div>
              ) : threads.length === 0 ? (
                <div className={styles.emptyState}>
                  No threads yet. Start a chat on the Agent page.
                </div>
              ) : (
                threads.slice(0, 12).map((t) => {
                  const isToday = t.updatedAt.slice(0, 10) === todayStr;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={styles.navRow}
                      onClick={() => go("/agent")}
                      role="listitem"
                    >
                      <MessageCircle aria-hidden="true" style={{ width: 16, height: 16 }} />
                      <span>{t.title || "New Chat"}</span>
                      <small>
                        {isToday
                          ? "Today"
                          : new Date(t.updatedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                      </small>
                    </button>
                  );
                })
              )}
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/agent")}
                role="listitem"
              >
                <Bot aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.6 }} />
                <span>Open Agent</span>
              </button>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/studio")}
                role="listitem"
              >
                <Clock aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.6 }} />
                <span>View Studio</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
