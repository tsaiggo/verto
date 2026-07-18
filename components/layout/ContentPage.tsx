import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ContentPageWidth = "compact" | "standard" | "wide" | "fluid";

interface ContentPageProps extends HTMLAttributes<HTMLDivElement> {
  width?: ContentPageWidth;
  innerClassName?: string;
  children: ReactNode;
}

/**
 * Shared scroll owner and centered measure for every product route.
 *
 * The desktop shell owns window chrome; this component owns the route's
 * content rhythm so pages no longer invent their own gutters and widths.
 */
export function ContentPage({
  width = "standard",
  className,
  innerClassName,
  children,
  ...props
}: ContentPageProps) {
  return (
    <div className={cn("content-page", className)} data-content-page data-page-scroll {...props}>
      <div className={cn("content-page__inner", `content-page__inner--${width}`, innerClassName)}>
        {children}
      </div>
    </div>
  );
}

interface ContentHeaderProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  icon?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}

/** Compact Codex-style route identity. */
export function ContentHeader({
  title,
  description,
  eyebrow,
  icon,
  meta,
  actions,
  className,
  ...props
}: ContentHeaderProps) {
  return (
    <header className={cn("content-header", className)} data-content-header {...props}>
      <div className="content-header__identity">
        {icon ? (
          <span className="content-header__icon" aria-hidden>
            {icon}
          </span>
        ) : null}
        <div className="content-header__copy">
          {eyebrow ? <div className="content-header__eyebrow">{eyebrow}</div> : null}
          <h1 className="content-header__title">{title}</h1>
          {description ? <p className="content-header__description">{description}</p> : null}
          {meta ? <div className="content-header__meta">{meta}</div> : null}
        </div>
      </div>
      {actions ? <div className="content-header__actions">{actions}</div> : null}
    </header>
  );
}

interface ContentBodyProps extends HTMLAttributes<HTMLDivElement> {
  aside?: ReactNode;
  children: ReactNode;
}

/** Optional main/inspector split that collapses cleanly on smaller screens. */
export function ContentBody({ aside, className, children, ...props }: ContentBodyProps) {
  return (
    <div className={cn("content-body", aside && "content-body--split", className)} {...props}>
      <div className="content-body__main">{children}</div>
      {aside ? <aside className="content-body__aside">{aside}</aside> : null}
    </div>
  );
}
