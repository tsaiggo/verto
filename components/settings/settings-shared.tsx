"use client";

// Shared primitives + types for the Settings view.

export type ThemeChoice = "light" | "dark" | "system";

export const ACCENTS = [
  "#15191f",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#16a34a",
  "#d97706",
  "#0891b2",
  "#dc2626",
];

export interface Toggles {
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
export type ToggleState = Toggles;
export type ToggleKey = keyof Toggles;
export type SetFn = (key: ToggleKey) => (next: boolean) => void;

export function Toggle({
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

export function ToggleRow({
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

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="set-field">
      <span className="set-field-label">{label}</span>
      {children}
    </label>
  );
}

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="set-card">
      <h2 className="set-card-title">{title}</h2>
      {children}
    </section>
  );
}
