"use client";

import { useState, useSyncExternalStore } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { ACCENTS, type ThemeChoice, type Toggles } from "@/components/settings/settings-shared";
import {
  AboutPanel,
  AgentPanel,
  AppearancePanel,
  EditorPanel,
  GeneralPanel,
  PrivacyPanel,
  ReadingPanel,
  ShortcutsPanel,
} from "@/components/settings/settings-panels";

type SectionId =
  | "general"
  | "appearance"
  | "editor"
  | "reading"
  | "agent"
  | "privacy"
  | "shortcuts"
  | "about";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "editor", label: "Editor" },
  { id: "reading", label: "Reading" },
  { id: "agent", label: "AI & Agent" },
  { id: "privacy", label: "Privacy" },
  { id: "shortcuts", label: "Keyboard Shortcuts" },
  { id: "about", label: "About" },
];

const SUBTITLE: Record<SectionId, string> = {
  general: "General Settings",
  appearance: "Appearance Settings",
  editor: "Editor Settings",
  reading: "Reading Settings",
  agent: "AI & Agent Settings",
  privacy: "Privacy Settings",
  shortcuts: "Keyboard Shortcuts",
  about: "About Verto",
};

const THEME_KEY = "theme";

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
}: {
  initialSection?: SectionId;
} = {}) {
  const [section, setSection] = useState<SectionId>(initialSection);

  // Theme — shares the app-wide mechanism (localStorage "theme" + .dark class).
  // useSyncExternalStore keeps the hydrated value SSR-safe and reactive to the
  // synthetic "storage" event dispatched by applyTheme (and by ThemeToggle).
  const theme = useSyncExternalStore(subscribeTheme, getStoredTheme, getServerTheme);
  const [accent, setAccent] = useState(ACCENTS[1]);

  const [toggles, setToggles] = useState<Toggles>({
    updates: true,
    restoreTabs: true,
    lineNumbers: true,
    spellcheck: true,
    autosave: true,
    vim: false,
    readingTime: true,
    footnotes: false,
    grounding: true,
    approval: true,
    tokenUsage: false,
    telemetry: false,
    chatHistory: true,
    externalLinks: true,
  });
  const set = (key: keyof typeof toggles) => (next: boolean) =>
    setToggles((prev) => ({ ...prev, [key]: next }));

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

      <div className="v-page set-page">
        <div className="set-layout">
          <nav className="set-nav" aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`set-nav-item${s.id === section ? " is-active" : ""}`}
                onClick={() => setSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>

          <div className="set-panels">
            {section === "general" ? <GeneralPanel toggles={toggles} set={set} /> : null}
            {section === "appearance" ? (
              <AppearancePanel
                theme={theme}
                onTheme={applyTheme}
                accent={accent}
                onAccent={setAccent}
              />
            ) : null}
            {section === "editor" ? <EditorPanel toggles={toggles} set={set} /> : null}
            {section === "reading" ? <ReadingPanel toggles={toggles} set={set} /> : null}
            {section === "agent" ? <AgentPanel toggles={toggles} set={set} /> : null}
            {section === "privacy" ? <PrivacyPanel toggles={toggles} set={set} /> : null}
            {section === "shortcuts" ? <ShortcutsPanel /> : null}
            {section === "about" ? <AboutPanel /> : null}
          </div>
        </div>
      </div>
    </>
  );
}
