import Link from "next/link";
import type { ReactNode } from "react";

interface CardProps {
  title: string;
  description?: string;
  href?: string;
  icon?: ReactNode;
  children?: ReactNode;
}

/**
 * <Card> — a content card with optional icon, title, description and link.
 * When `href` is provided the entire card is clickable; internal links go
 * through Next's `<Link>`.
 */
export function Card({ title, description, href, icon, children }: CardProps) {
  const body = (
    <>
      {icon && (
        <span className="card-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="card-body">
        <span className="card-title">{title}</span>
        {description && <span className="card-desc">{description}</span>}
        {children && <span className="card-extra">{children}</span>}
      </span>
    </>
  );

  if (!href) {
    return <div className="card">{body}</div>;
  }
  const isExternal = /^https?:\/\//.test(href);
  if (isExternal) {
    return (
      <a className="card is-link" href={href} target="_blank" rel="noreferrer noopener">
        {body}
      </a>
    );
  }
  return (
    <Link className="card is-link" href={href}>
      {body}
    </Link>
  );
}

interface CardGroupProps {
  cols?: 1 | 2 | 3 | 4;
  children: ReactNode;
}

/**
 * <CardGroup cols={n}> — responsive grid wrapping multiple `<Card>` children.
 */
export function CardGroup({ cols = 2, children }: CardGroupProps) {
  return (
    <div className="card-group" style={{ ["--card-cols" as string]: cols }}>
      {children}
    </div>
  );
}

export default Card;
