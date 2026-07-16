"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { Settings2 } from "lucide-react";
import { ContentHeader, ContentPage } from "@/components/layout/ContentPage";
import { useOnboardingReturn } from "@/components/integrations/use-onboarding-return";
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
import styles from "./Settings.module.css";

export type SectionId =
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

const DESCRIPTION: Record<SectionId, string> = {
  general: "Understand where workspace content and state live.",
  sources: "Review the content source available to this build.",
  appearance: "Choose how the Verto interface follows light and dark mode.",
  editor: "Review the editor's current file and save behavior.",
  reading: "Set document width, density, text size, and typeface.",
  agent: "Review the active assistant provider and local credential.",
  privacy: "See what stays local and what is sent when you use the assistant.",
  shortcuts: "Reference keyboard commands supported across the workspace.",
  about: "Version, build, runtime, updates, and project links.",
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

function notifyThemeChanged() {
  const event =
    typeof StorageEvent === "function"
      ? new StorageEvent("storage", { key: THEME_KEY })
      : new Event("storage");
  window.dispatchEvent(event);
}

function buildLabel(): string {
  const commit = process.env.NEXT_PUBLIC_VERTO_BUILD_SHA?.trim();
  if (commit) return `Commit ${commit.slice(0, 10)}`;
  return process.env.NODE_ENV === "development" ? "Development build" : "Production build";
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
  const fromOnboarding = useOnboardingReturn();

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const centerActiveSection = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active || nav.scrollWidth <= nav.clientWidth) return;

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
    notifyThemeChanged();
  }

  return (
    <ContentPage width="standard">
      <ContentHeader title="Settings" description={DESCRIPTION[section]} icon={<Settings2 />} />

      <div className={styles.layout}>
        <nav ref={navRef} className={styles.nav} aria-label="Settings sections">
          {SECTIONS.map((item) => (
            <Link
              key={item.id}
              href={settingsHref(item.id)}
              className={styles.navItem}
              data-active={item.id === section ? "true" : undefined}
              aria-current={item.id === section ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div
          id={`settings-${section}-panel`}
          className={styles.panels}
          aria-label={`${SECTIONS.find((item) => item.id === section)?.label ?? "Settings"} settings`}
        >
          {section === "general" ? <GeneralPanel /> : null}
          {section === "sources" ? <SourcesPanel source={source} /> : null}
          {section === "appearance" ? <AppearancePanel theme={theme} onTheme={applyTheme} /> : null}
          {section === "editor" ? <EditorPanel /> : null}
          {section === "reading" ? <ReadingPanel /> : null}
          {section === "agent" ? <AgentPanel fromOnboarding={fromOnboarding} /> : null}
          {section === "privacy" ? <PrivacyPanel /> : null}
          {section === "shortcuts" ? <ShortcutsPanel /> : null}
          {section === "about" ? <AboutPanel version={version} build={buildLabel()} /> : null}
        </div>
      </div>
    </ContentPage>
  );
}
