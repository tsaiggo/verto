import type { HTMLAttributes, ReactNode } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ContentToolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("content-toolbar", className)} {...props} />;
}

interface ContentSectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function ContentSection({
  title,
  description,
  actions,
  className,
  children,
  ...props
}: ContentSectionProps) {
  return (
    <section className={cn("content-section", className)} {...props}>
      {title || description || actions ? (
        <div className="content-section__header">
          <div>
            {title ? <h2 className="content-section__title">{title}</h2> : null}
            {description ? <p className="content-section__description">{description}</p> : null}
          </div>
          {actions ? <div className="content-section__actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

interface ContentPanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "plain" | "outlined" | "floating";
}

export function ContentPanel({ variant = "plain", className, ...props }: ContentPanelProps) {
  return <div className={cn("content-panel", `content-panel--${variant}`, className)} {...props} />;
}

interface ContentRowProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  leading?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
}

export function ContentRow({
  leading,
  title,
  description,
  metadata,
  actions,
  className,
  ...props
}: ContentRowProps) {
  return (
    <div className={cn("content-row", className)} {...props}>
      {leading ? <div className="content-row__leading">{leading}</div> : null}
      <div className="content-row__copy">
        <div className="content-row__title">{title}</div>
        {description ? <div className="content-row__description">{description}</div> : null}
      </div>
      {metadata ? <div className="content-row__metadata">{metadata}</div> : null}
      {actions ? <div className="content-row__actions">{actions}</div> : null}
    </div>
  );
}

interface ContentEmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function ContentEmptyState({
  icon,
  title,
  description,
  action,
  compact,
  className,
  ...props
}: ContentEmptyStateProps) {
  return (
    <div className={cn("content-empty", compact && "content-empty--compact", className)} {...props}>
      {icon ? <div className="content-empty__icon">{icon}</div> : null}
      <h2 className="content-empty__title">{title}</h2>
      {description ? <p className="content-empty__description">{description}</p> : null}
      {action ? <div className="content-empty__action">{action}</div> : null}
    </div>
  );
}

interface ContentStatusProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  status?: "loading" | "error" | "neutral";
  icon?: ReactNode;
  action?: ReactNode;
}

export function ContentStatus({
  title,
  description,
  status = "neutral",
  icon: customIcon,
  action,
  className,
  ...props
}: ContentStatusProps) {
  const icon =
    customIcon ??
    (status === "loading" ? (
      <LoaderCircle className="content-status__spinner" aria-hidden />
    ) : status === "error" ? (
      <AlertCircle aria-hidden />
    ) : null);

  return (
    <div
      className={cn("content-status", `content-status--${status}`, className)}
      role={status === "error" ? "alert" : "status"}
      aria-live="polite"
      {...props}
    >
      {icon ? <div className="content-status__icon">{icon}</div> : null}
      <div className="content-status__copy">
        <strong>{title}</strong>
        {description ? <span>{description}</span> : null}
      </div>
      {action ? <div className="content-status__action">{action}</div> : null}
    </div>
  );
}
