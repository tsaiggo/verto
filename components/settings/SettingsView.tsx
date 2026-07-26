"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import PageHeader from "@/components/layout/PageHeader";
import type { SourceInfo } from "@/lib/source-info";
import type { ThemeChoice } from "@/components/settings/settings-shared";
import {
  AboutPanel,
  AgentPanel,
  AppearancePanel,
  EditorPanel,
  FilesPanel,
  GeneralPanel,
  PrivacyPanel,
  ReadingPanel,
  ShortcutsPanel,
} from "@/components/settings/settings-panels";
import styles from "./Settings.module.css";

type SectionId =
  | "general"
  | "files"
  | "appearance"
  | "editor"
  | "reading"
  | "agent"
  | "privacy"
  | "shortcuts"
  | "about";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "files", label: "Files" },
  { id: "appearance", label: "Appearance" },
  { id: "editor", label: "Editor" },
  { id: "reading", label: "Reading" },
  { id: "agent", label: "AI & Agent" },
  { id: "privacy", label: "Privacy" },
  { id: "shortcuts", label: "Keyboard Shortcuts" },
  { id: "about", label: "About" },
];

const SUBTITLE: Record<SectionId, string> = {
  general: "Workspace behavior and first-run guidance",
  files: "Local folders, file ownership, and system sync",
  appearance: "Theme and visual preferences",
  editor: "Markdown and MDX authoring",
  reading: "Document typography and reading controls",
  agent: "AI provider, local credentials, and Agent access",
  privacy: "What stays local and what leaves the device",
  shortcuts: "Keyboard commands available across Verto",
  about: "Version, documentation, and updates",
};

const THEME_KEY = "theme";

function settingsHref(section: SectionId): string {
  return section === "general" ? "/settings" : `/settings/${section}`;
}

function getStoredTheme(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function getServerTheme(): ThemeChoice {
  return "system";
}

function subscribeTheme(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export default function SettingsView({
  initialSection = "general",
  source,
  version,
}: {
  initialSection?: SectionId;
  source: SourceInfo;
  version: string;
}) {
  const section = initialSection;

  // Theme — shares the app-wide mechanism (localStorage "theme" + .dark class).
  // useSyncExternalStore keeps the hydrated value SSR-safe and reactive to the
  // synthetic "storage" event dispatched by applyTheme (and by ThemeToggle).
  const theme = useSyncExternalStore(subscribeTheme, getStoredTheme, getServerTheme);
  function applyTheme(next: ThemeChoice) {
    if (next === "system") {
      window.localStorage.removeItem(THEME_KEY);
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.classList.toggle("dark", dark);
    } else {
      window.localStorage.setItem(THEME_KEY, next);
      document.documentElement.classList.toggle("dark", next === "dark");
    }
    // Notify this tab (native storage events only fire in other tabs);
    // useSyncExternalStore re-reads the persisted choice.
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY }));
  }

  return (
    <>
      <PageHeader title="Settings" subtitle={SUBTITLE[section]} />

      <div className={styles.page}>
        <div className={styles.layout}>
          <nav className={styles.nav} aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <Link
                key={s.id}
                href={settingsHref(s.id)}
                className={`${styles.navItem}${s.id === section ? ` ${styles.navItemActive}` : ""}`}
                aria-current={s.id === section ? "page" : undefined}
              >
                {s.label}
              </Link>
            ))}
          </nav>

          <div className={styles.panels}>
            {section === "general" ? <GeneralPanel /> : null}
            {section === "files" ? <FilesPanel source={source} /> : null}
            {section === "appearance" ? (
              <AppearancePanel theme={theme} onTheme={applyTheme} />
            ) : null}
            {section === "editor" ? <EditorPanel /> : null}
            {section === "reading" ? <ReadingPanel /> : null}
            {section === "agent" ? <AgentPanel /> : null}
            {section === "privacy" ? <PrivacyPanel /> : null}
            {section === "shortcuts" ? <ShortcutsPanel /> : null}
            {section === "about" ? <AboutPanel version={version} /> : null}
          </div>
        </div>
      </div>
    </>
  );
}
