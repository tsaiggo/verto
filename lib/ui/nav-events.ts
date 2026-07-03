/**
 * Lightweight global event used to open the mobile navigation drawer from any
 * page-level header, without threading a callback through every route. The
 * application shell listens for it and opens the slide-over nav.
 */
export const OPEN_NAV_EVENT = "verto:open-nav";

export function openMobileNav(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_NAV_EVENT));
}
