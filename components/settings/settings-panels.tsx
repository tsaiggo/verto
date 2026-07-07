"use client";

// Per-section panels for the Settings view (General, Appearance, Editor, Reading,
// AI & Agent, Privacy, Keyboard Shortcuts, About).
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SourceInfo } from "@/lib/source-info";
import {
  ACCENTS,
  Card,
  Field,
  ToggleRow,
  type SetFn,
  type ThemeChoice,
  type ToggleState,
} from "@/components/settings/settings-shared";

export function SourcesPanel({ source }: { source: SourceInfo }) {
  return (
    <Card title="Library source">
      <div className="set-row">
        <span className="set-row-text">
          <strong>{source.name}</strong>
          <small>{source.label}</small>
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
            Verto reads .mdx and .md files from one source at a time — a local folder, a GitHub
            repository, or OneDrive. Changes take effect on the next build.
          </small>
        </span>
      </div>
    </Card>
  );
}

export function GeneralPanel({ toggles, set }: { toggles: ToggleState; set: SetFn }) {
  return (
    <>
      <Card title="Workspace">
        <Field label="Workspace name">
          <input className="set-input" defaultValue="Verto Knowledge" />
        </Field>
        <Field label="Default library">
          <select className="set-select" defaultValue="local">
            <option value="local">Local Library</option>
            <option value="github">GitHub</option>
            <option value="onedrive">OneDrive</option>
          </select>
        </Field>
        <Field label="Startup">
          <select className="set-select" defaultValue="previous">
            <option value="previous">Open previous workspace</option>
            <option value="home">Open home</option>
            <option value="last">Open last document</option>
          </select>
        </Field>
        <Field label="Update channel">
          <select className="set-select" defaultValue="stable">
            <option value="stable">Stable</option>
            <option value="beta">Beta</option>
            <option value="nightly">Nightly</option>
          </select>
        </Field>
      </Card>
      <Card title="Behavior">
        <ToggleRow
          label="Check for updates automatically"
          checked={toggles.updates}
          onChange={set("updates")}
        />
        <ToggleRow
          label="Restore open tabs"
          checked={toggles.restoreTabs}
          onChange={set("restoreTabs")}
        />
      </Card>
    </>
  );
}

export function AppearancePanel({
  theme,
  onTheme,
  accent,
  onAccent,
}: {
  theme: ThemeChoice;
  onTheme: (next: ThemeChoice) => void;
  accent: string;
  onAccent: (next: string) => void;
}) {
  return (
    <div className="set-appearance">
      <section className="set-card">
        <h2 className="set-card-title">Appearance</h2>

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

        <p className="set-group-label">Accent color</p>
        <div className="set-accents">
          {ACCENTS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Accent ${c}`}
              aria-pressed={accent === c}
              className={`set-accent${accent === c ? " is-active" : ""}`}
              style={{ background: c }}
              onClick={() => onAccent(c)}
            />
          ))}
        </div>

        <Field label="Density">
          <select className="set-select" defaultValue="comfortable">
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
            <option value="cozy">Cozy</option>
          </select>
        </Field>
        <Field label="Font size">
          <select className="set-select" defaultValue="14">
            <option value="13">13px</option>
            <option value="14">14px</option>
            <option value="15">15px</option>
            <option value="16">16px</option>
          </select>
        </Field>
      </section>

      <section className="set-card set-preview">
        <h2 className="set-card-title">Preview</h2>
        <article className="set-preview-doc">
          <h3>Agent-native Workflows</h3>
          <p>Designing knowledge work that thinks with you.</p>
          <div className="set-preview-tags">
            <span className="set-chip">MDX</span>
            <span className="set-chip">Published</span>
          </div>
        </article>
      </section>
    </div>
  );
}

export function EditorPanel({ toggles, set }: { toggles: ToggleState; set: SetFn }) {
  return (
    <Card title="Editor">
      <ToggleRow
        label="Show line numbers"
        checked={toggles.lineNumbers}
        onChange={set("lineNumbers")}
      />
      <ToggleRow label="Spellcheck" checked={toggles.spellcheck} onChange={set("spellcheck")} />
      <ToggleRow
        label="Auto-save"
        description="Persist changes as you type."
        checked={toggles.autosave}
        onChange={set("autosave")}
      />
      <ToggleRow label="Vim keybindings" checked={toggles.vim} onChange={set("vim")} />
      <Field label="Tab size">
        <select className="set-select" defaultValue="2">
          <option value="2">2 spaces</option>
          <option value="4">4 spaces</option>
          <option value="tab">Tabs</option>
        </select>
      </Field>
    </Card>
  );
}

export function ReadingPanel({ toggles, set }: { toggles: ToggleState; set: SetFn }) {
  return (
    <Card title="Reading">
      <Field label="Reading width">
        <select className="set-select" defaultValue="comfortable">
          <option value="narrow">Narrow</option>
          <option value="comfortable">Comfortable</option>
          <option value="wide">Wide</option>
        </select>
      </Field>
      <Field label="Line height">
        <select className="set-select" defaultValue="relaxed">
          <option value="tight">Tight</option>
          <option value="normal">Normal</option>
          <option value="relaxed">Relaxed</option>
        </select>
      </Field>
      <ToggleRow
        label="Show reading time"
        checked={toggles.readingTime}
        onChange={set("readingTime")}
      />
      <ToggleRow
        label="Render footnotes inline"
        checked={toggles.footnotes}
        onChange={set("footnotes")}
      />
    </Card>
  );
}

export function AgentPanel({ toggles, set }: { toggles: ToggleState; set: SetFn }) {
  return (
    <Card title="AI & Agent">
      <Field label="Default model">
        <select className="set-select" defaultValue="claude">
          <option value="claude">Claude Opus</option>
          <option value="gpt">GPT-5</option>
          <option value="gemini">Gemini Pro</option>
          <option value="local">Local model</option>
        </select>
      </Field>
      <ToggleRow
        label="Ground responses in sources"
        description="Every answer cites documents in your library."
        checked={toggles.grounding}
        onChange={set("grounding")}
      />
      <ToggleRow
        label="Require approval for writes"
        description="Review agent edits before they are applied."
        checked={toggles.approval}
        onChange={set("approval")}
      />
      <ToggleRow
        label="Show token usage"
        checked={toggles.tokenUsage}
        onChange={set("tokenUsage")}
      />
      <Field label="Custom instructions">
        <textarea
          className="set-textarea"
          rows={3}
          defaultValue="Prefer concise answers grounded in my notes. Cite sources."
        />
      </Field>
    </Card>
  );
}

export function PrivacyPanel({ toggles, set }: { toggles: ToggleState; set: SetFn }) {
  return (
    <Card title="Privacy">
      <ToggleRow
        label="Send anonymous telemetry"
        description="Help improve Verto with usage analytics."
        checked={toggles.telemetry}
        onChange={set("telemetry")}
      />
      <ToggleRow
        label="Store chat history"
        checked={toggles.chatHistory}
        onChange={set("chatHistory")}
      />
      <ToggleRow
        label="Allow external links"
        checked={toggles.externalLinks}
        onChange={set("externalLinks")}
      />
      <div className="set-row">
        <span className="set-row-text">
          <strong>Local cache</strong>
          <small>Clear indexed content and thumbnails.</small>
        </span>
        <button type="button" className="v-btn v-btn--sm">
          Clear cache
        </button>
      </div>
    </Card>
  );
}

const SHORTCUTS: { action: string; keys: string[] }[] = [
  { action: "Search", keys: ["⌘", "K"] },
  { action: "New document", keys: ["⌘", "N"] },
  { action: "Ask agent", keys: ["⌘", "J"] },
  { action: "Command palette", keys: ["⌘", "⇧", "P"] },
  { action: "Toggle sidebar", keys: ["⌘", "\\"] },
  { action: "Toggle theme", keys: ["⌘", "⇧", "L"] },
  { action: "Save", keys: ["⌘", "S"] },
  { action: "Go to Library", keys: ["G", "L"] },
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

export function AboutPanel() {
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
            <dd>1.0.0</dd>
          </div>
          <div>
            <dt>Build</dt>
            <dd>2025.06.01</dd>
          </div>
          <div>
            <dt>License</dt>
            <dd>MIT</dd>
          </div>
        </dl>
        <div className="set-about-actions">
          <button type="button" className="v-btn v-btn--sm">
            Release notes
          </button>
          <button type="button" className="v-btn v-btn--sm">
            Documentation
          </button>
          <button type="button" className="v-btn v-btn--primary v-btn--sm">
            Check for updates
          </button>
        </div>
      </div>
    </Card>
  );
}
