import type { ReactNode } from "react";

interface PageHeaderProps {
  /** Primary page title (left). Omitted when `left` is supplied. */
  title?: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
  /** Custom left content, replacing the title/subtitle block. */
  left?: ReactNode;
  /** Custom right content (page-specific actions). */
  right?: ReactNode;
  /** Extra controls placed before any custom right content. */
  tools?: ReactNode;
  /** Visual identity for entity-style page headers. */
  icon?: ReactNode;
  /** Honest page metadata shown below the title and description. */
  meta?: ReactNode;
  /** Entity headers reproduce the desktop workbench's full identity band. */
  variant?: "default" | "entity";
  /** Adds bottom padding so the header hugs following sub-navigation. */
  flush?: boolean;
}

/**
 * Per-page header row used across dashboard routes (Library, Collections,
 * Tags, ...). Title/subtitle on the left; page-specific actions (`tools` /
 * `right`) on the right. The application rail owns global search while the
 * top bar provides context, theme, and overflow controls, so this header never
 * repeats workspace-level navigation.
 */
export default function PageHeader({
  title,
  subtitle,
  left,
  right,
  tools,
  icon,
  meta,
  variant = "default",
  flush,
}: PageHeaderProps) {
  const entity = variant === "entity";

  return (
    <header
      className={`pgh${entity ? " is-entity" : ""}${flush ? " is-flush" : ""}`}
      data-page-identity={entity ? "" : undefined}
    >
      <div className="pgh-left">
        {icon && (
          <span className="pgh-entity-icon" aria-hidden>
            {icon}
          </span>
        )}
        <div className="pgh-copy">
          {left ?? (
            <>
              {title && <h1 className="pgh-title">{title}</h1>}
              {subtitle && <p className="pgh-subtitle">{subtitle}</p>}
            </>
          )}
          {meta && <div className="pgh-meta">{meta}</div>}
        </div>
      </div>

      <div className="pgh-right">
        {tools}
        {right}
      </div>
    </header>
  );
}
