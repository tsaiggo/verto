import Link from "next/link";
import type { ReactNode } from "react";

export type TimelineStatus = "done" | "doing" | "todo";
export type TimelineOrientation = "vertical" | "horizontal";

interface TimelineProps {
  children?: ReactNode;
  /** Layout direction. `vertical` (default) stacks items; `horizontal` scrolls. */
  orientation?: TimelineOrientation;
}

/**
 * <Timeline> — vertical or horizontal sequence of <TimelineItem> entries.
 *
 * Pure server component; the visual rail (vertical line / horizontal track)
 * is drawn via a CSS pseudo-element on `.timeline`. Orientation switches
 * via a data attribute so styles stay in `app/globals.css`.
 */
export function Timeline({ children, orientation = "vertical" }: TimelineProps) {
  return (
    <ol className="timeline" data-orientation={orientation}>
      {children}
    </ol>
  );
}

interface TimelineItemProps {
  /** ISO date string or any value parseable by `new Date()`. Optional. */
  date?: string;
  title: string;
  status?: TimelineStatus;
  /** Optional decorative icon (emoji or React node) shown inside the marker. */
  icon?: ReactNode;
  /** Optional list of small tags rendered next to the title. */
  tags?: string[];
  /** If provided, the entire item becomes a link. */
  href?: string;
  children?: ReactNode;
}

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/**
 * Format a date string for display. Falls back to the raw string when the
 * input can't be parsed, so authors can pass partial dates like "2024-Q3".
 */
function formatDate(raw: string): string {
  // Pure year-month strings like "2024-09" are interpreted as UTC by
  // `new Date()`, which can flip the displayed month for users west of UTC.
  // Pin the day to the 1st and treat as local time to keep authors' intent.
  const ymMatch = /^(\d{4})-(\d{2})$/.exec(raw);
  if (ymMatch) {
    const year = Number(ymMatch[1]);
    const month = Number(ymMatch[2]) - 1;
    const d = new Date(year, month, 1);
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
    }).format(d);
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return DATE_FORMATTER.format(d);
}

/**
 * <TimelineItem> — single entry in a <Timeline>.
 *
 * Visual: a status-colored marker (dot or icon) attached to a content card
 * with date, title, optional tags, and free-form children. When `href` is
 * provided the entire card becomes an `<a>` (external) or Next `<Link>`
 * (internal); otherwise it's a static `<article>`.
 */
export function TimelineItem({
  date,
  title,
  status = "todo",
  icon,
  tags,
  href,
  children,
}: TimelineItemProps) {
  const marker = (
    <span className="timeline-marker" aria-hidden="true">
      {icon ?? null}
    </span>
  );

  const body = (
    <div className="timeline-card">
      {date && (
        <time className="timeline-date" dateTime={date}>
          {formatDate(date)}
        </time>
      )}
      <div className="timeline-title-row">
        <span className="timeline-title">{title}</span>
        {tags && tags.length > 0 && (
          <span className="timeline-tags">
            {tags.map((t, i) => (
              <span key={i} className="timeline-tag">
                {t}
              </span>
            ))}
          </span>
        )}
      </div>
      {children && <div className="timeline-content">{children}</div>}
    </div>
  );

  const inner = (
    <>
      {marker}
      {body}
    </>
  );

  if (!href) {
    return (
      <li className="timeline-item" data-status={status}>
        {inner}
      </li>
    );
  }

  const isExternal = /^https?:\/\//.test(href);
  if (isExternal) {
    return (
      <li className="timeline-item is-link" data-status={status}>
        <a className="timeline-link" href={href} target="_blank" rel="noreferrer noopener">
          {inner}
        </a>
      </li>
    );
  }
  return (
    <li className="timeline-item is-link" data-status={status}>
      <Link className="timeline-link" href={href}>
        {inner}
      </Link>
    </li>
  );
}

export default Timeline;
