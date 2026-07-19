"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import UpdateCheckButton from "@/components/desktop/UpdateCheckButton";
import AssistantConnectPanel from "@/components/integrations/AssistantConnectPanel";
import VertoMark from "@/components/layout/VertoMark";
import ReadingPreferences from "@/components/settings/ReadingPreferences";
import { Button, buttonVariants } from "@/components/ui/button";
import { useHasMounted } from "@/components/ui/use-has-mounted";
import type { SourceInfo } from "@/lib/source-info";
import { isTauri } from "@/lib/tauri";
import { Card, SettingRow, type ThemeChoice } from "@/components/settings/settings-shared";
import styles from "./Settings.module.css";

export function SourcesPanel({ source }: { source: SourceInfo }) {
  return (
    <Card
      title="Sources"
      description="The build source is always available; device folders and feeds are managed separately."
    >
      <SettingRow
        title={source.name}
        description={`Build content: ${source.label}`}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/integrations">
              Manage sources
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />
      <SettingRow
        title="Supported runtime sources"
        description="Local Markdown and MDX folders appear in Library. RSS and Atom subscriptions appear in Inbox."
      />
    </Card>
  );
}

export function GeneralPanel() {
  return (
    <Card
      title="Workspace"
      description="Verto keeps your documents and workspace state inspectable."
    >
      <SettingRow
        title="Your source files stay yours"
        description="Verto reads Markdown and MDX from the source you choose. Disconnecting a device folder never deletes it."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/integrations">
              Manage sources
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />
      <SettingRow
        title="Portable workspace state"
        description="Desktop libraries keep Verto state in the library's .verto folder after pending writes finish. Browser-only state stays in this browser."
      />
    </Card>
  );
}

const THEME_OPTIONS: {
  value: ThemeChoice;
  label: string;
  description: string;
}[] = [
  { value: "light", label: "Light", description: "Always use the light interface" },
  { value: "dark", label: "Dark", description: "Always use the dark interface" },
  { value: "system", label: "System", description: "Follow the operating system" },
];

export function AppearancePanel({
  theme,
  onTheme,
}: {
  theme: ThemeChoice;
  onTheme: (next: ThemeChoice) => void;
}) {
  return (
    <Card title="Appearance" description="Theme changes apply across the entire workspace.">
      <fieldset className={styles.choiceSection}>
        <legend>Theme</legend>
        <p>Choose a fixed theme or follow the operating system.</p>
        <div className={styles.choiceGrid}>
          {THEME_OPTIONS.map((option) => {
            const id = `theme-${option.value}`;
            return (
              <div key={option.value}>
                <input
                  id={id}
                  className={styles.choiceInput}
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={theme === option.value}
                  onChange={() => onTheme(option.value)}
                />
                <label className={styles.choiceLabel} htmlFor={id}>
                  <span className={styles.choiceTitle}>
                    {option.label}
                    <Check className={styles.choiceCheck} aria-hidden />
                  </span>
                  <span className={styles.choiceDescription}>{option.description}</span>
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>
      <SettingRow
        title="Document typography"
        description="Reader width, density, text size, and typeface have their own controls."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/reading">Reading settings</Link>
          </Button>
        }
      />
    </Card>
  );
}

export function EditorPanel() {
  return (
    <Card title="Editor" description="The editor exposes only behavior that is available today.">
      <SettingRow
        title="Markdown and MDX source"
        description="Switch between source and rendered preview while editing."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/editor">
              Open editor
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        }
      />
      <SettingRow
        title="Save behavior"
        description="Verto desktop saves into the connected local Library. The web app exports the document as a download."
      />
    </Card>
  );
}

export function ReadingPanel() {
  return (
    <Card
      title="Reading"
      description="These preferences use the same state as the controls inside an open document."
    >
      <ReadingPreferences />
    </Card>
  );
}

export function AgentPanel({ fromOnboarding = false }: { fromOnboarding?: boolean }) {
  return (
    <Card
      title="AI & Agent"
      description="Provider availability is fixed by this build; credentials stay on this device."
    >
      {fromOnboarding ? (
        <div className={styles.onboardingReturn}>
          <div>
            <strong>Assistant setup</strong>
            <p>Configure the available provider, then return to setup when you are ready.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/onboarding/ai">
              <ArrowLeft aria-hidden />
              Back to setup
            </Link>
          </Button>
        </div>
      ) : null}
      <AssistantConnectPanel />
    </Card>
  );
}

export function PrivacyPanel() {
  return (
    <Card title="Privacy" description="A concise account of Verto's current data behavior.">
      <SettingRow
        title="No anonymous telemetry"
        description="Verto does not send usage analytics."
      />
      <SettingRow
        title="Assistant requests are explicit"
        description="Verto contacts the configured provider only after you ask. A request includes your credential, question, and the source context needed to answer."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/agent">Manage credential</Link>
          </Button>
        }
      />
      <SettingRow
        title="Conversation history"
        description="Delete individual conversations from the Agent workspace."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/agent">Open Agent</Link>
          </Button>
        }
      />
    </Card>
  );
}

const SHORTCUTS: { action: string; keys: string[] }[] = [
  { action: "Search", keys: ["Cmd / Ctrl", "K"] },
  { action: "New document", keys: ["Cmd / Ctrl", "N"] },
];

export function ShortcutsPanel() {
  return (
    <Card
      title="Keyboard Shortcuts"
      description="Commands currently handled by the workspace shell."
    >
      <ul className={styles.shortcutList}>
        {SHORTCUTS.map((shortcut) => (
          <li key={shortcut.action} className={styles.shortcut}>
            <span>{shortcut.action}</span>
            <span className={styles.keys}>
              {shortcut.keys.map((key) => (
                <kbd key={key} className={styles.key}>
                  {key}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AboutPanel({ version, build }: { version: string; build: string }) {
  const hasMounted = useHasMounted();
  const desktop = hasMounted && isTauri();
  const runtime = hasMounted ? (desktop ? "Desktop" : "Web") : "Detecting";

  return (
    <Card title="About" description="Release identity and support links for this Verto build.">
      <div className={styles.about}>
        <div className={styles.aboutBrand}>
          <span className={styles.aboutMark}>
            <VertoMark size={24} />
          </span>
          <div>
            <strong>Verto</strong>
            <small>Local-first knowledge with an auditable agent.</small>
          </div>
        </div>
        <dl className={styles.aboutMeta}>
          <div>
            <dt>Version</dt>
            <dd>{version}</dd>
          </div>
          <div>
            <dt>Build</dt>
            <dd>{build}</dd>
          </div>
          <div>
            <dt>Runtime</dt>
            <dd>{runtime}</dd>
          </div>
          <div>
            <dt>License</dt>
            <dd>Apache-2.0</dd>
          </div>
        </dl>
        <div className={styles.aboutActions}>
          <Button asChild variant="outline" size="sm">
            <a
              href="https://github.com/tsaiggo/verto/releases"
              target="_blank"
              rel="noopener noreferrer"
            >
              Release notes
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/help">Documentation</Link>
          </Button>
          {desktop ? (
            <UpdateCheckButton
              className={buttonVariants({ variant: "default", size: "sm" })}
              checkingChildren="Checking..."
            >
              Check for updates
            </UpdateCheckButton>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
