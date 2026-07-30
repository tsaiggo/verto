/**
 * Replace the current same-origin URL without asking the App Router to perform
 * a new route transition.
 *
 * Next's native History API integration keeps `usePathname` and
 * `useSearchParams` synchronized. This is especially useful when only query
 * state changes on a statically rendered route: the production router can
 * otherwise decide that the pathname is already current and leave stale query
 * parameters in the address bar.
 */
export function replaceCurrentRoute(href: string): void {
  if (typeof window === "undefined") return;

  const target = new URL(href, window.location.href);
  if (target.origin !== window.location.origin) {
    throw new Error("replaceCurrentRoute only accepts same-origin URLs.");
  }

  window.history.replaceState(null, "", `${target.pathname}${target.search}${target.hash}`);
}
