/** Cancelable intent fired before an imperative Next.js route transition. */
export const APP_NAVIGATION_INTENT_EVENT = "verto:app-navigation-intent";

/**
 * Return false when an active surface (currently the Editor) vetoes an
 * imperative route transition. Normal links are handled by the browser click
 * path; this closes the gap for router.push calls and global shortcuts.
 */
export function requestAppNavigation(): boolean {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return true;
  return window.dispatchEvent(new Event(APP_NAVIGATION_INTENT_EVENT, { cancelable: true }));
}
