"use client";

import Link from "next/link";
import { forwardRef, type ComponentProps, type MouseEvent } from "react";

type MailViewLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

function mailDestination(href: string): URL | null {
  if (typeof window === "undefined" || window.location.pathname !== "/mail") return null;
  const destination = new URL(href, window.location.href);
  return destination.origin === window.location.origin && destination.pathname === "/mail"
    ? destination
    : null;
}

/** Return false when the caller needs a normal router navigation to another page. */
export function navigateMailView(href: string, options: { replace?: boolean } = {}): boolean {
  const destination = mailDestination(href);
  if (!destination) return false;
  if (destination.href !== window.location.href) {
    // Next patches these APIs to notify useSearchParams while preserving its router state.
    if (options.replace) window.history.replaceState(null, "", destination.href);
    else window.history.pushState(null, "", destination.href);
  }
  return true;
}

/** Mail views share one client surface, so changing mailbox state needs no server payload. */
const MailViewLink = forwardRef<HTMLAnchorElement, MailViewLinkProps>(function MailViewLink(
  { href, onClick, onNavigate, replace, prefetch = false, ...props },
  ref
) {
  function click(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (event.currentTarget.target && event.currentTarget.target !== "_self") ||
      event.currentTarget.hasAttribute("download")
    )
      return;
    if (!mailDestination(href)) return;
    event.preventDefault();
    let cancelled = false;
    onNavigate?.({
      preventDefault: () => {
        cancelled = true;
      },
    });
    if (!cancelled) navigateMailView(href, { replace });
  }

  return (
    <Link
      {...props}
      ref={ref}
      href={href}
      replace={replace}
      prefetch={prefetch}
      onClick={click}
      onNavigate={onNavigate}
    />
  );
});

export default MailViewLink;
