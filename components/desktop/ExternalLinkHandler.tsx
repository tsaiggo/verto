"use client";

import { useEffect } from "react";
import { isTauri } from "@/lib/tauri";

/**
 * Decide whether a link should be handed to the system browser instead of
 * navigating the desktop webview. Returns the absolute URL to open, or `null`
 * to leave the click alone (same-origin app routes, in-page anchors, unknown
 * schemes, unparseable hrefs).
 *
 * Exported for unit testing; the click handler below applies it to live DOM
 * events.
 */
export function externalUrlToOpen(href: string | null, currentHref: string): string | null {
  if (!href) return null;

  let url: URL;
  try {
    url = new URL(href, currentHref);
  } catch {
    return null;
  }

  const isWebLink = url.protocol === "http:" || url.protocol === "https:";
  const isExternalWeb = isWebLink && url.origin !== new URL(currentHref).origin;
  const isMailOrTel = url.protocol === "mailto:" || url.protocol === "tel:";
  if (!isExternalWeb && !isMailOrTel) return null;

  return url.href;
}

/**
 * Routes external link clicks to the system browser when running inside the
 * Tauri desktop shell.
 *
 * In a plain browser an `<a href="https://…">` opens in a new tab as expected,
 * but inside the desktop webview the same click *navigates the app window*,
 * trapping the user on an external site with no way back. We intercept clicks
 * on anchors that point somewhere outside the app (absolute http/https URLs on
 * a different origin, plus `mailto:` / `tel:`) and hand them to the OS via the
 * opener plugin instead. Same-origin links (the app's own routes) are left
 * untouched so in-app navigation keeps working.
 *
 * Renders nothing and is inert in the web build (`isTauri()` is false).
 */
export default function ExternalLinkHandler() {
  useEffect(() => {
    if (!isTauri()) return;

    const handler = (event: MouseEvent) => {
      // Respect anything already handled, and let the browser keep its
      // modified-click behaviour (new tab / download / context menu).
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      const anchor =
        target instanceof Element ? target.closest("a[href]") : null;
      if (!anchor) return;

      const externalUrl = externalUrlToOpen(
        anchor.getAttribute("href"),
        window.location.href
      );
      if (!externalUrl) return;

      event.preventDefault();
      void import("@tauri-apps/plugin-opener")
        .then(({ openUrl }) => openUrl(externalUrl))
        .catch(() => {
          /* opening externally failed — nothing else we can safely do */
        });
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return null;
}
