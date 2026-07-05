"use client";

import { Menu } from "lucide-react";
import { openMobileNav } from "@/lib/ui/nav-events";

interface PageHeaderProps {
  /** Primary page title (left). Omitted when `left` is supplied. */
  title?: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
  /** Custom left content, replacing the title/subtitle block. */
  left?: React.ReactNode;
  /** Custom right content (page-specific actions). */
  right?: React.ReactNode;
  /** Extra controls placed before any custom right content. */
  tools?: React.ReactNode;
  /** Adds bottom padding so the header hugs following sub-navigation. */
  flush?: boolean;
}

/**
 * Per-page header row used across dashboard routes (Library, Collections,
 * Tags, …). Title/subtitle on the left; page-specific actions (`tools` /
 * `right`) on the right. The universal top bar owns the global search, theme,
 * and overflow controls, so this header no longer repeats them. On mobile it
 * exposes the nav drawer trigger.
 */
export default function PageHeader({
  title,
  subtitle,
  left,
  right,
  tools,
  flush,
}: PageHeaderProps) {
  return (
    <header className={`pgh${flush ? " is-flush" : ""}`}>
      <button
        type="button"
        className="pgh-menu"
        aria-label="Open navigation"
        onClick={openMobileNav}
      >
        <Menu className="h-4 w-4" aria-hidden />
      </button>

      <div className="pgh-left">
        {left ?? (
          <>
            {title && <h1 className="pgh-title">{title}</h1>}
            {subtitle && <p className="pgh-subtitle">{subtitle}</p>}
          </>
        )}
      </div>

      <div className="pgh-right">
        {tools}
        {right}
      </div>
    </header>
  );
}
