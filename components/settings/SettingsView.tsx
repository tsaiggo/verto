"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import PageHeader from "@/components/layout/PageHeader";
import type { SourceInfo } from "@/lib/source-info";
import type { ThemeChoice } from "@/components/settings/settings-shared";
import {
  AboutPanel,
  AgentPanel,
  AppearancePanel,
  EditorPanel,
  GeneralPanel,
  PrivacyPanel,
  ReadingPanel,
  ShortcutsPanel,
  SourcesPanel,
} from "@/components/settings/settings-panels";

type SectionId =
  | "general"
  | "sources"
  | "appearance"
  | "editor"
  | "reading"
  | "agent"
  | "privacy"
  | "shortcuts"
  | "about";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "sources", label: "Sources" },
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
  sources: "Library source",
  appearance: "Appearance Settings",
  editor: "Editor Settings",
  reading: "Reading Settings",
  agent: "AI & Agent Settings",
  privacy: "Privacy Settings",
  shortcuts: "Keyboard Shortcuts",
  about: "About Verto",
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
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const centerActiveSection = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active) return;

      const navRect = nav.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      const centered =
        nav.scrollLeft +
        (activeRect.left - navRect.left) -
        (nav.clientWidth - activeRect.width) / 2;
      nav.scrollLeft = Math.max(0, Math.min(centered, nav.scrollWidth - nav.clientWidth));
    };

    centerActiveSection();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(centerActiveSection);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [section]);

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

      <div className="v-page set-page">
        <div className="set-layout">
          <nav ref={navRef} className="set-nav" aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <Link
                key={s.id}
                href={settingsHref(s.id)}
                className={`set-nav-item${s.id === section ? " is-active" : ""}`}
                aria-current={s.id === section ? "page" : undefined}
              >
                {s.label}
              </Link>
            ))}
          </nav>

          <div className="set-panels">
            {section === "general" ? <GeneralPanel /> : null}
            {section === "sources" ? <SourcesPanel source={source} /> : null}
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
