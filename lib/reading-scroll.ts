/**
 * Reading UI scroll container resolution.
 *
 * The app renders as a fixed 100dvh frame where the window itself never
 * scrolls. Reader routes use a dedicated `[data-page-scroll]` region beneath
 * the fixed identity and tab bands, while compact document routes still use
 * `#main-content`. Legacy layouts and tests fall back to the document element.
 */
export function getReadingScrollElement(): HTMLElement {
  // During an App Router transition the loading frame and resolved document
  // can briefly coexist. Bind reading progress to the frame that owns the
  // real article instead of whichever `[data-page-scroll]` happens to appear
  // first in document order.
  const articleScroller = document
    .querySelector<HTMLElement>("[data-article]")
    ?.closest<HTMLElement>("[data-page-scroll]");

  return (
    articleScroller ??
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
