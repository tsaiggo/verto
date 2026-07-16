import type { ReactNode } from "react";

export const CODEX_ROUTE_STATE_STANDALONE_CSS = `
  :root {
    color-scheme: light dark;
    --codex-surface: #ffffff;
    --codex-control: #f4f4f4;
    --codex-control-hover: #ebebeb;
    --codex-border-soft: rgba(13, 13, 13, 0.065);
    --codex-border: rgba(13, 13, 13, 0.1);
    --codex-text: #0d0d0d;
    --codex-text-secondary: #5d5d5d;
    --codex-text-tertiary: #6f6f6f;
    --codex-focus: #7057d9;
    --primary: #0d0d0d;
    --primary-foreground: #ffffff;
  }
  html,
  body {
    background: var(--codex-surface);
    color: var(--codex-text);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --codex-surface: #212121;
      --codex-control: #2a2a2a;
      --codex-control-hover: #303030;
      --codex-border-soft: rgba(255, 255, 255, 0.08);
      --codex-border: rgba(255, 255, 255, 0.12);
      --codex-text: #ececec;
      --codex-text-secondary: #b4b4b4;
      --codex-text-tertiary: #9a9a9a;
      --codex-focus: #a78bfa;
      --primary: #ececec;
      --primary-foreground: #111111;
    }
  }
  .codex-route-state {
    box-sizing: border-box;
    display: flex;
    width: min(100%, 520px);
    flex-direction: column;
    align-items: flex-start;
    color: var(--codex-text, #0d0d0d);
    font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .codex-route-state--center { align-items: center; text-align: center; }
  .codex-route-state__mark {
    display: inline-flex;
    min-width: 32px;
    height: 32px;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    padding: 0 8px;
    border: 1px solid var(--codex-border-soft, rgba(13, 13, 13, 0.065));
    border-radius: 8px;
    background: var(--codex-control, #f4f4f4);
    color: var(--codex-text-tertiary, #6f6f6f);
    font-size: 12px;
    font-weight: 600;
  }
  .codex-route-state__eyebrow {
    margin: 14px 0 0;
    color: var(--codex-text-tertiary, #6f6f6f);
    font-size: 12px;
    font-weight: 600;
  }
  .codex-route-state__title {
    margin: 6px 0 0;
    color: var(--codex-text, #0d0d0d);
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.02em;
    line-height: 1.25;
  }
  .codex-route-state__description {
    max-width: 54ch;
    margin: 9px 0 0;
    color: var(--codex-text-secondary, #5d5d5d);
    font-size: 14px;
    line-height: 1.55;
  }
  .codex-route-state__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 22px;
  }
  .codex-route-state__actions [data-slot="button"] {
    box-sizing: border-box;
    display: inline-flex;
    min-height: 36px;
    align-items: center;
    justify-content: center;
    padding: 0 14px;
    border: 1px solid;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    line-height: 1;
    text-decoration: none;
  }
  .codex-route-state__actions [data-slot="button"]:focus-visible {
    outline: 2px solid var(--codex-focus, #7057d9);
    outline-offset: 2px;
  }
  .codex-route-state__action--primary {
    border-color: transparent;
    background: var(--primary, #0d0d0d);
    color: var(--primary-foreground, #ffffff);
  }
  .codex-route-state__action--secondary {
    border-color: var(--codex-border, rgba(13, 13, 13, 0.1));
    background: transparent;
    color: var(--codex-text, #0d0d0d);
  }
`;

interface CodexRouteStateProps {
  actions?: ReactNode;
  align?: "start" | "center";
  description: string;
  eyebrow?: string;
  kind: "error" | "not-found";
  mark?: string;
  standalone?: boolean;
  title: string;
}

/**
 * Shared restrained state treatment for route errors and missing pages.
 * Route files keep ownership of their surrounding workspace geometry while
 * this component keeps hierarchy, actions, and dark-mode tokens consistent.
 */
export default function CodexRouteState({
  actions,
  align = "start",
  description,
  eyebrow,
  kind,
  mark = kind === "not-found" ? "404" : "!",
  standalone = false,
  title,
}: CodexRouteStateProps) {
  return (
    <>
      {standalone ? (
        <style data-codex-state-fallback>{CODEX_ROUTE_STATE_STANDALONE_CSS}</style>
      ) : null}
      <section
        className={`codex-route-state${align === "center" ? " codex-route-state--center" : ""}`}
        data-state={kind}
        role={kind === "error" ? "alert" : undefined}
      >
        <span className="codex-route-state__mark" aria-hidden>
          {mark}
        </span>
        {eyebrow ? <p className="codex-route-state__eyebrow">{eyebrow}</p> : null}
        <h1 className="codex-route-state__title">{title}</h1>
        <p className="codex-route-state__description">{description}</p>
        {actions ? <div className="codex-route-state__actions">{actions}</div> : null}
      </section>
    </>
  );
}
