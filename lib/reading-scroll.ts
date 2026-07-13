/**
 * Reading UI scroll container resolution.
 *
 * The app renders as a fixed 100dvh frame where the window itself never
 * scrolls. Reader routes use a dedicated `[data-page-scroll]` region beneath
 * the fixed identity and tab bands, while compact document routes still use
 * `#main-content`. Legacy layouts and tests fall back to the document element.
 */
export function getReadingScrollElement(): HTMLElement {
  return (
    document.querySelector<HTMLElement>("[data-page-scroll]") ??
    document.getElementById("main-content") ??
    document.documentElement
  );
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
