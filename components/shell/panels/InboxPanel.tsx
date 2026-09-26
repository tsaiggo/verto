"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Command,
  PanelLeft,
  Newspaper,
  Archive,
  CheckCheck,
  Mail,
} from "lucide-react";
import { loadInbox, subscribeInbox, type InboxStatus } from "@/lib/inbox";
import styles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import wsStyles from "@/components/shell/WorkspaceShell.module.css";

const TABS: ReadonlyArray<{ id: InboxStatus | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "read", label: "Read" },
  { id: "archived", label: "Archived" },
];

function getSnapshot(): string {
  return JSON.stringify(loadInbox());
}
function getServerSnapshot(): string {
  return JSON.stringify({ items: [] });
}

function openGlobalCommand() {
  const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
  if (trigger) trigger.click();
}

export default function InboxPanel({ onCollapse }: { onCollapse?: () => void }) {
  const router = useRouter();
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [subsCollapsed, setSubsCollapsed] = useState(false);
  const snapshot = useSyncExternalStore(subscribeInbox, getSnapshot, getServerSnapshot);
  const parsed = JSON.parse(snapshot) as {
    items: Array<{ id: string; status: InboxStatus; sourceName: string }>;
  };
  const items = parsed.items;

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0, unread: 0, read: 0, archived: 0 };
    for (const it of items) {
      if (it.status !== "archived") c.all += 1;
      if (it.status === "unread" || it.status === "reading") c.unread += 1;
      if (it.status === "read") c.read += 1;
      if (it.status === "archived") c.archived += 1;
    }
    return c;
  }, [items]);

  const sources = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      const name = it.sourceName?.trim() || "Unknown feed";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [items]);

  const go = useCallback((href: string) => router.push(href), [router]);

  return (
    <div className={wsStyles.panelInner} data-testid="workspace-inbox-panel">
      <header className={styles.brandRow}>
        <div className={styles.workspaceSwitch}>
          <button type="button" className={styles.workspaceButton}>
            <span className={styles.gradientMark} aria-hidden="true" />
            <strong>Inbox</strong>
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

        <section className={styles.navigationSection} aria-labelledby="ws-inbox-filters">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!filtersCollapsed}
              onClick={() => setFiltersCollapsed((v) => !v)}
            >
              <ChevronDown className={filtersCollapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-inbox-filters">Filters</span>
            </button>
          </div>
          {!filtersCollapsed && (
            <div className={styles.navList} role="list">
              {TABS.map(({ id, label }) => {
                const count = counts[id] ?? 0;
                const Icon =
                  id === "archived"
                    ? Archive
                    : id === "read"
                      ? CheckCheck
                      : id === "unread"
                        ? Mail
                        : Newspaper;
                return (
                  <button
                    key={id}
                    type="button"
                    className={styles.navRow}
                    onClick={() => go("/inbox")}
                    role="listitem"
                    aria-label={`${label} filter`}
                  >
                    <Icon aria-hidden="true" style={{ width: 16, height: 16 }} />
                    <span>{label}</span>
                    <small>{count}</small>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className={styles.navigationSection} aria-labelledby="ws-inbox-sources">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!subsCollapsed}
              onClick={() => setSubsCollapsed((v) => !v)}
            >
              <ChevronDown className={subsCollapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-inbox-sources">Feeds</span>
            </button>
          </div>
          {!subsCollapsed && (
            <div className={styles.navList} role="list">
              {sources.length === 0 ? (
                <div className={styles.emptyState}>
                  No feed items. Add a subscription on the Inbox page.
                </div>
              ) : (
                sources.map((s) => (
                  <button
                    key={s.name}
                    type="button"
                    className={styles.navRow}
                    onClick={() => go("/inbox")}
                    role="listitem"
                  >
                    <Newspaper aria-hidden="true" style={{ width: 16, height: 16 }} />
                    <span>{s.name}</span>
                    <small>{s.count}</small>
                  </button>
                ))
              )}
              <button
                type="button"
                className={styles.navRow}
                onClick={() => go("/inbox#subscriptions")}
                role="listitem"
              >
                <Newspaper aria-hidden="true" style={{ width: 16, height: 16, opacity: 0.6 }} />
                <span>Manage subscriptions</span>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
