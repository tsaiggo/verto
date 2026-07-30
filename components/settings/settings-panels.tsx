"use client";

// Per-section panels for the Settings view (General, Appearance, Editor, Reading,
// AI & Agent, Privacy, Keyboard Shortcuts, About).
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import UpdateCheckButton from "@/components/desktop/UpdateCheckButton";
import AssistantConnectPanel from "@/components/integrations/AssistantConnectPanel";
import PlatformShortcut from "@/components/layout/PlatformShortcut";
import type { SourceInfo } from "@/lib/source-info";
import { Card, type ThemeChoice } from "@/components/settings/settings-shared";
import styles from "./Settings.module.css";

export function GeneralPanel() {
  return (
    <Card
      title="General"
      description="Verto opens portable files and keeps setup decisions reversible."
    >
      <div className={styles.row}>
        <span className={styles.rowText}>
          <strong>Local-first workspace</strong>
          <small>
            Documents, annotations, and Agent receipts stay with the workspace on this device.
          </small>
        </span>
        <Link href="/library" className="v-btn v-btn--sm">
          Open Library
          <ArrowRight aria-hidden />
        </Link>
      </div>
      <div className={styles.row}>
        <span className={styles.rowText}>
          <strong>First-run guide</strong>
          <small>
            Replay folder, indexing, and optional AI setup without changing current files.
          </small>
        </span>
        <Link href="/onboarding" className="v-btn v-btn--sm">
          Open setup
          <ArrowRight aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

export function FilesPanel({ source }: { source: SourceInfo }) {
  return (
    <Card
      title="Files"
      description="Verto reads Markdown in place. Cross-device sync is handled by the folder provider you already use."
    >
      <div className={styles.row}>
        <span className={styles.rowText}>
          <strong>Current content source</strong>
          <small>{source.label}</small>
        </span>
        <Link href="/integrations#local-files" className="v-btn v-btn--sm">
          Manage folder
          <ArrowRight aria-hidden />
        </Link>
      </div>
      <div className={styles.row}>
        <span className={styles.rowText}>
          <strong>Supported files</strong>
          <small>
            Verto indexes <code>.md</code> and <code>.mdx</code>. Other files are left untouched.
          </small>
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowText}>
          <strong>OneDrive, Dropbox, and network folders</strong>
          <small>
            Choose their local synced folder. Verto does not create a second cloud copy or run its
            own sync service.
          </small>
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowText}>
          <strong>Save coordination</strong>
          <small>
            Saves check the revision on disk before replacing it. Windows also blocks active
            external writers during that exchange; macOS and Linux preserve displaced document
            versions and expect sync tools to publish changes atomically.
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
    <Card title="Appearance" description="Choose one theme across the workspace.">
      <p className={styles.groupLabel} id="theme-setting-label">
        Theme
      </p>
      <div className={styles.segmented} role="group" aria-labelledby="theme-setting-label">
        {(["light", "dark", "system"] as ThemeChoice[]).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={theme === t}
            className={`${styles.segment}${theme === t ? ` ${styles.segmentActive}` : ""}`}
            onClick={() => onTheme(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <span className={styles.rowText}>
          <strong>Typography and density</strong>
          <small>Reader-specific typography is controlled from an open document.</small>
        </span>
      </div>
    </Card>
  );
}

export function EditorPanel() {
  return (
    <Card title="Editor" description="Author portable Markdown and MDX with rendered preview.">
      <div className={styles.row}>
        <span className={styles.rowText}>
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
    </Card>
  );
}

export function ReadingPanel() {
  return (
    <Card
      title="Reading"
      description="Reading controls are saved from the document where you use them."
    >
      <div className={styles.row}>
        <span className={styles.rowText}>
          <strong>Document controls</strong>
          <small>
            Reading width, text size, density, and font controls are available from the settings
            button while you&apos;re reading a document.
          </small>
        </span>
        <Link href="/read/demo" className="v-btn v-btn--sm">
          Open a document
          <ArrowRight aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

export function AgentPanel() {
  return (
    <Card
      title="AI & Agent"
      description="AI is optional. Answers cite local context, and file changes require approval."
    >
      <div className={styles.row}>
        <span className={styles.rowText}>
          <strong>Provider support</strong>
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
    <Card
      title="Privacy"
      description="A clear boundary between local reading and provider requests."
    >
      <div className={styles.row}>
        <span className={styles.rowText}>
          <strong>No anonymous telemetry</strong>
          <small>Verto does not send usage analytics.</small>
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowText}>
          <strong>Provider access key</strong>
          <small>
            Verto contacts the configured AI provider only after you ask. It sends your saved
            provider access key for authorization, your question, and either the current document or
            source titles and relevant excerpts.
          </small>
        </span>
      </div>
      <div className={styles.row}>
        <span className={styles.rowText}>
          <strong>Chat history</strong>
          <small>Manage individual conversations from the Agent workspace.</small>
        </span>
      </div>
    </Card>
  );
}

const SHORTCUTS: { action: string; command: string }[] = [
  { action: "Search", command: "K" },
  { action: "New document", command: "N" },
];

export function ShortcutsPanel() {
  return (
    <Card
      title="Keyboard Shortcuts"
      description="Commands use the native modifier for your platform."
    >
      <ul className={styles.shortcuts}>
        {SHORTCUTS.map((s) => (
          <li key={s.action} className={styles.shortcut}>
            <span>{s.action}</span>
            <span className={styles.keys}>
              <PlatformShortcut className={styles.kbd} command={s.command} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AboutPanel({ version }: { version: string }) {
  return (
    <Card title="About" description="Build information and support resources.">
      <div className={styles.about}>
        <div className={styles.aboutBrand}>
          <span className={styles.aboutMark}>V</span>
          <div>
            <strong>Verto</strong>
            <small>Local-first knowledge, with an auditable agent.</small>
          </div>
        </div>
        <dl className={styles.aboutMeta}>
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
        <div className={styles.aboutActions}>
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
