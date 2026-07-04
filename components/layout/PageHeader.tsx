"use client";

import { Menu } from "lucide-react";
import HeaderActions from "@/components/layout/HeaderActions";
import { openMobileNav } from "@/lib/ui/nav-events";

interface PageHeaderProps {
  /** Primary page title (left). Omitted when `left` is supplied. */
  title?: string;
  /** Optional secondary line under the title. */
  subtitle?: string;
  /** Custom left content, replacing the title/subtitle block. */
  left?: React.ReactNode;
  /** Custom right content, replacing the standard action cluster. */
  right?: React.ReactNode;
  /** Extra controls placed just before the standard action cluster. */
  tools?: React.ReactNode;
  /** Hide the standard search/theme/notification/overflow cluster. */
  hideActions?: boolean;
  /** Adds bottom padding so the header hugs following sub-navigation. */
  flush?: boolean;
}

/**
 * Per-page header row used across dashboard routes (Home, Library, Collections,
 * …). Title/subtitle on the left; the shared search + theme + notifications +
 * overflow cluster on the right. On mobile it exposes the nav drawer trigger.
 */
export default function PageHeader({
  title,
  subtitle,
  left,
  right,
  tools,
  hideActions,
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
        {right ?? (hideActions ? null : <HeaderActions />)}
      </div>
    </header>
  );
}
