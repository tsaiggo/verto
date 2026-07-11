"use client";

// Per-section panels for the Settings view (General, Appearance, Editor, Reading,
// AI & Agent, Privacy, Keyboard Shortcuts, About).
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import UpdateCheckButton from "@/components/desktop/UpdateCheckButton";
import AssistantConnectPanel from "@/components/integrations/AssistantConnectPanel";
import type { SourceInfo } from "@/lib/source-info";
import { Card, type ThemeChoice } from "@/components/settings/settings-shared";

export function SourcesPanel({ source }: { source: SourceInfo }) {
  return (
    <Card title="Library source">
      <div className="set-row">
        <span className="set-row-text">
          <strong>Local Library</strong>
          <small>{source.kind === "local" ? source.label : "Choose a folder from Sources"}</small>
        </span>
        <Link href="/integrations" className="v-btn v-btn--sm">
          Manage sources
          <ArrowRight aria-hidden />
        </Link>
      </div>
      <div className="set-row">
        <span className="set-row-text">
          <strong>How sources work</strong>
          <small>
            Verto reads .mdx and .md files from your local library. RSS and Atom feeds are managed
            in Inbox subscriptions.
          </small>
        </span>
      </div>
    </Card>
  );
}

export function GeneralPanel() {
  return (
    <Card title="Workspace">
      <div className="set-row">
        <span className="set-row-text">
          <strong>Your source files stay yours</strong>
          <small>
            Connect a local Markdown or MDX folder, or manage RSS and Atom feeds from Inbox.
          </small>
        </span>
        <Link href="/integrations" className="v-btn v-btn--sm">
          Manage sources
          <ArrowRight aria-hidden />
        </Link>
      </div>
      <div className="set-row">
        <span className="set-row-text">
          <strong>Workspace preferences</strong>
          <small>
            Startup, tab restoration, and release-channel preferences are not configurable yet.
          </small>
        </span>
      </div>
    </Card>
  );
}

export function AppearancePanel({
  theme,
  onTheme,
}: {
  theme: ThemeChoice;
  onTheme: (next: ThemeChoice) => void;
}) {
  return (
    <Card title="Appearance">
      <p className="set-group-label">Theme</p>
      <div className="set-seg" role="tablist" aria-label="Theme">
        {(["light", "dark", "system"] as ThemeChoice[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={theme === t}
            className={`set-seg-item${theme === t ? " is-active" : ""}`}
            onClick={() => onTheme(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="set-row">
        <span className="set-row-text">
          <strong>Typography and density</strong>
          <small>Reader-specific typography is controlled from an open document.</small>
        </span>
      </div>
    </Card>
  );
}

export function EditorPanel() {
  return (
    <Card title="Editor">
      <div className="set-row">
        <span className="set-row-text">
          <strong>Source and preview</strong>
          <small>
            Verto&apos;s editor supports Markdown and MDX source with a rendered preview. Desktop
            builds can save files back to the folder you selected.
          </small>
        </span>
        <Link href="/editor" className="v-btn v-btn--sm">
          Open editor
          <ArrowRight aria-hidden />
        </Link>
      </div>
      <div className="set-row">
        <span className="set-row-text">
          <strong>Editor preferences</strong>
          <small>
            Line numbers, autosave, Vim bindings, and tab size are not configurable yet.
          </small>
        </span>
      </div>
    </Card>
  );
}

export function ReadingPanel() {
  return (
    <Card title="Reading">
      <div className="set-row">
        <span className="set-row-text">
          <strong>Document controls</strong>
          <small>
            Reading width, text size, density, and font controls are available from the settings
            button while you&apos;re reading a document.
          </small>
        </span>
      </div>
    </Card>
  );
}

export function AgentPanel() {
  return (
    <Card title="AI & Agent">
      <div className="set-row">
        <span className="set-row-text">
          <strong>Assistant provider</strong>
          <small>
            Verto currently supports GitHub Models when that provider is enabled in the build.
          </small>
        </span>
      </div>
      <AssistantConnectPanel />
    </Card>
  );
}

export function PrivacyPanel() {
  return (
    <Card title="Privacy">
      <div className="set-row">
        <span className="set-row-text">
          <strong>No anonymous telemetry</strong>
          <small>Verto does not send usage analytics.</small>
        </span>
      </div>
      <div className="set-row">
        <span className="set-row-text">
          <strong>Local assistant credentials</strong>
          <small>
            A saved assistant token stays on this device and is sent only when you request an AI
            response from the configured provider.
          </small>
        </span>
      </div>
      <div className="set-row">
        <span className="set-row-text">
          <strong>Chat history</strong>
          <small>Manage individual conversations from the Agent workspace.</small>
        </span>
      </div>
    </Card>
  );
}

const SHORTCUTS: { action: string; keys: string[] }[] = [
  { action: "Search", keys: ["⌘ / Ctrl", "K"] },
];

export function ShortcutsPanel() {
  return (
    <Card title="Keyboard Shortcuts">
      <ul className="set-shortcuts">
        {SHORTCUTS.map((s) => (
          <li key={s.action} className="set-shortcut">
            <span>{s.action}</span>
            <span className="set-keys">
              {s.keys.map((k, i) => (
                <kbd key={i} className="set-kbd">
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AboutPanel({ version }: { version: string }) {
  return (
    <Card title="About">
      <div className="set-about">
        <div className="set-about-brand">
          <span className="set-about-mark">V</span>
          <div>
            <strong>Verto</strong>
            <small>Local-first knowledge, with an auditable agent.</small>
          </div>
        </div>
        <dl className="set-about-meta">
          <div>
            <dt>Version</dt>
            <dd>{version}</dd>
          </div>
          <div>
            <dt>Build</dt>
            <dd>See release metadata</dd>
          </div>
          <div>
            <dt>License</dt>
            <dd>Apache-2.0</dd>
          </div>
        </dl>
        <div className="set-about-actions">
          <a
            href="https://github.com/tsaiggo/verto/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="v-btn v-btn--sm"
          >
            Release notes
          </a>
          <Link href="/help" className="v-btn v-btn--sm">
            Documentation
          </Link>
          <UpdateCheckButton
            className="v-btn v-btn--primary v-btn--sm"
            checkingChildren="Checking..."
          >
            Check for updates
          </UpdateCheckButton>
        </div>
      </div>
    </Card>
  );
}
