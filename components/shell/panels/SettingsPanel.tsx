"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Command,
  PanelLeft,
  Settings2,
  Palette,
  FileText,
  BookOpen,
  Shield,
  Keyboard,
  Info,
  FolderCog,
} from "lucide-react";
import styles from "@/components/library/AdaptedWorkspaceSidebar.module.css";
import wsStyles from "@/components/shell/WorkspaceShell.module.css";

function openGlobalCommand() {
  const trigger = document.querySelector("[data-command-trigger]") as HTMLElement | null;
  if (trigger) trigger.click();
}

const SECTIONS: Array<{ id: string; label: string; href: string; icon: typeof Settings2 }> = [
  { id: "general", label: "General", href: "/settings", icon: Settings2 },
  { id: "files", label: "Files", href: "/settings/files", icon: FolderCog },
  { id: "appearance", label: "Appearance", href: "/settings/appearance", icon: Palette },
  { id: "editor", label: "Editor", href: "/settings/editor", icon: FileText },
  { id: "reading", label: "Reading", href: "/settings/reading", icon: BookOpen },
  { id: "agent", label: "AI & Agent", href: "/settings/agent", icon: Settings2 },
  { id: "privacy", label: "Privacy", href: "/settings/privacy", icon: Shield },
  { id: "shortcuts", label: "Keyboard Shortcuts", href: "/settings/shortcuts", icon: Keyboard },
  { id: "about", label: "About", href: "/settings/about", icon: Info },
];

export default function SettingsPanel({ onCollapse }: { onCollapse?: () => void }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const go = useCallback((href: string) => router.push(href), [router]);

  return (
    <div className={wsStyles.panelInner} data-testid="workspace-settings-panel">
      <header className={styles.brandRow}>
        <div className={styles.workspaceSwitch}>
          <button type="button" className={styles.workspaceButton}>
            <span className={styles.gradientMark} aria-hidden="true" />
            <strong>Settings</strong>
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

        <section className={styles.navigationSection} aria-labelledby="ws-settings-sections">
          <div className={styles.sectionHeading}>
            <button
              type="button"
              className={styles.sectionTitle}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((v) => !v)}
            >
              <ChevronDown className={collapsed ? styles.turned : ""} aria-hidden="true" />
              <span id="ws-settings-sections">Sections</span>
            </button>
          </div>
          {!collapsed && (
            <div className={styles.navList} role="list">
              {SECTIONS.map(({ label, href, icon: Icon }) => (
                <button
                  key={href}
                  type="button"
                  className={styles.navRow}
                  onClick={() => go(href)}
                  role="listitem"
                >
                  <Icon aria-hidden="true" style={{ width: 16, height: 16 }} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
