/**
 * Reading UI scroll container resolution.
 *
 * The app renders as a fixed 100dvh frame where the window itself never
 * scrolls; the inner content region (#main-content) is the single scroll
 * container. Reading progress and scroll restoration therefore observe that
 * element instead of the document. When the frame is absent (legacy layouts
 * or tests) this falls back to the document element, which restores the
 * original window-scroll behavior.
 */
export function getReadingScrollElement(): HTMLElement {
  return document.getElementById("main-content") ?? document.documentElement;
}

/**
 * Resolves the event target that emits scroll events for a scroll element.
 * Scroll events do not bubble, so an inner element must be observed directly.
 * When the scroller is the document element, scrolling surfaces on window, so
 * we listen there instead.
 */
export function getReadingScrollEventTarget(element: HTMLElement): Window | HTMLElement {
  return element === document.documentElement ? window : element;
}
