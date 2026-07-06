// Shared primitives for the `/final` reference-scaffold surfaces
// (see `FinalPackScreen.tsx`): category predicates plus the small building
// blocks (header, tabs, card) and the reference-shell chrome.

import type { ReactNode } from "react";
import type { FinalPackItem } from "@/components/final/final-pack-data";
import { referenceNav } from "@/components/final/final-fixtures";

export function isReader(item: FinalPackItem) {
  return item.category === "Reader" || item.category === "Reader & Annotation";
}

export function isEditor(item: FinalPackItem) {
  return item.category === "Editor" || item.category === "Editor & MDX Authoring";
}

export function Header({ item, actions }: { item: FinalPackItem; actions?: ReactNode }) {
  return (
    <header className="final-head">
      <div>
        <p className="final-kicker">
          {item.category} / {item.state} / Board {item.sourceBoard}
        </p>
        <h1>{item.title}</h1>
        <p>{item.notes}</p>
      </div>
      {actions ? <div className="final-actions">{actions}</div> : null}
    </header>
  );
}

export function Tabs({ labels, active = 0 }: { labels: string[]; active?: number }) {
  return (
    <div className="final-tabs" role="tablist">
      {labels.map((label, index) => (
        <span key={label} className={`final-tab${index === active ? " is-active" : ""}`}>
          {label}
        </span>
      ))}
    </div>
  );
}

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`final-card ${className}`}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}

export function ReferenceStage({
  children,
  tone = "light",
}: {
  children: ReactNode;
  tone?: "light" | "dark" | "device";
}) {
  return <div className={`final-reference-stage is-${tone}`}>{children}</div>;
}

export function ReferenceShell({
  active = "Home",
  dark = false,
  children,
}: {
  active?: string;
  dark?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`final-ref-page${dark ? " is-dark" : ""}`}>
      <aside className="final-ref-sidebar">
        <div className="final-ref-brand">
          <span>V</span>
          <strong>verto</strong>
        </div>
        <nav className="final-ref-nav" aria-label="Reference navigation">
          {referenceNav.map(([label, icon, badge], index) => (
            <span
              key={label}
              className={`${label === active ? "is-active " : ""}${index === 7 ? "has-separator" : ""}`}
            >
              <i>{icon}</i>
              <b>{label}</b>
              {badge ? <small>{badge}</small> : null}
            </span>
          ))}
        </nav>
        <div className="final-ref-spacer" />
        <span className="final-ref-settings">
          <i>⚙</i>
          <b>Settings</b>
        </span>
        <div className="final-ref-profile">
          <em>AC</em>
          <span>
            <strong>Alex Chen</strong>
            <small>Pro plan</small>
          </span>
          <b>⌄</b>
        </div>
      </aside>
      <main className="final-ref-main">
        <div className="final-ref-topbar">
          <span />
          <div className="final-ref-top-actions">
            <div className="final-ref-search">
              ⌕&nbsp;&nbsp;Search Verto <kbd>⌘ K</kbd>
            </div>
            <button type="button" aria-label="Toggle theme">
              ☼
            </button>
            <button type="button" aria-label="Focus">
              ♢
            </button>
            <button type="button" aria-label="More">
              ⋮
            </button>
          </div>
        </div>
        <div className="final-ref-content">{children}</div>
      </main>
    </div>
  );
}
