// Persisted, clamped width for the reader's slide-over chat companion.
//
// The companion is right-anchored, so a drag handle on its left edge resizes it
// and the chosen width survives reloads (localStorage). The clamp is kept pure
// and DOM-free so the boundary logic is unit-testable; only load/save touch
// storage, guarded for environments where it is unavailable.

const KEY = "verto:chat-width";

/** Narrowest the companion may get before markdown answers feel cramped. */
export const CHAT_WIDTH_MIN = 360;
/** Widest the companion may get before it dominates the reading room. */
export const CHAT_WIDTH_MAX = 640;
/** Comfortable default (wide enough for markdown answers without hiding the TOC). */
export const CHAT_WIDTH_DEFAULT = 440;
/** Never exceed this fraction of the viewport (small-laptop guard). */
const VIEWPORT_FRACTION = 0.92;

/**
 * Clamp a raw pixel width to [MIN, MAX] and the viewport guard. On very small
 * viewports the guard can fall below MIN, in which case the guard wins so the
 * panel never overflows the screen.
 */
export function clampChatWidth(raw: number, viewportW: number): number {
  const ceiling = Math.min(CHAT_WIDTH_MAX, Math.round(viewportW * VIEWPORT_FRACTION));
  const floor = Math.min(CHAT_WIDTH_MIN, ceiling);
  const value = Number.isFinite(raw) ? Math.round(raw) : CHAT_WIDTH_DEFAULT;
  return Math.max(floor, Math.min(ceiling, value));
}

/** Load the saved width (clamped to the current viewport), or the default. */
export function loadChatWidth(viewportW: number): number {
  let stored: number | null = null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw != null) {
      const n = Number.parseInt(raw, 10);
      if (Number.isFinite(n)) stored = n;
    }
  } catch {
    /* storage may be unavailable; fall back to the default */
  }
  return clampChatWidth(stored ?? CHAT_WIDTH_DEFAULT, viewportW);
}

/** Persist the chosen width. Silently ignores storage failures. */
export function saveChatWidth(width: number): void {
  try {
    window.localStorage.setItem(KEY, String(Math.round(width)));
  } catch {
    /* storage may be unavailable; width is a convenience */
  }
}
