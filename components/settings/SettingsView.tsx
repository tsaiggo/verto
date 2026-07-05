"use client";

import { useState, useSyncExternalStore } from "react";
import PageHeader from "@/components/layout/PageHeader";

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

const ACCENTS = [
  "#15191f",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#16a34a",
  "#d97706",
  "#0891b2",
  "#dc2626",
];

type ThemeChoice = "light" | "dark" | "system";

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

interface Toggles {
  updates: boolean;
  restoreTabs: boolean;
  lineNumbers: boolean;
  spellcheck: boolean;
  autosave: boolean;
  vim: boolean;
  readingTime: boolean;
  footnotes: boolean;
  grounding: boolean;
  approval: boolean;
  tokenUsage: boolean;
  telemetry: boolean;
  chatHistory: boolean;
  externalLinks: boolean;
}
type ToggleKey = keyof Toggles;
type SetFn = (key: ToggleKey) => (next: boolean) => void;

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`set-toggle${checked ? " is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="set-toggle-knob" />
    </button>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="set-row">
      <span className="set-row-text">
        <strong>{label}</strong>
        {description ? <small>{description}</small> : null}
      </span>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="set-field">
      <span className="set-field-label">{label}</span>
      {children}
    </label>
  );
}

export default function SettingsView() {
  const [section, setSection] = useState<SectionId>("general");

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

type ToggleState = Toggles;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="set-card">
      <h2 className="set-card-title">{title}</h2>
      {children}
    </section>
  );
}

function GeneralPanel({ toggles, set }: { toggles: ToggleState; set: SetFn }) {
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

function AppearancePanel({
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

function EditorPanel({ toggles, set }: { toggles: ToggleState; set: SetFn }) {
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

function ReadingPanel({ toggles, set }: { toggles: ToggleState; set: SetFn }) {
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

function AgentPanel({ toggles, set }: { toggles: ToggleState; set: SetFn }) {
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

function PrivacyPanel({ toggles, set }: { toggles: ToggleState; set: SetFn }) {
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

function ShortcutsPanel() {
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

function AboutPanel() {
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
