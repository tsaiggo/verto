/** Maximum number of recently-read documents to remember. */
export const MAX_RECENT_READINGS = 5;

/** `localStorage` key for reading state. */
export const READING_STATE_KEY = "verto:reading-state";

export interface ReadingEntry {
  href: string;
  slug: string[];
  title: string;
  path: string;
  lastReadAt: string;
  progress: number;
  scrollTop: number;
}

export interface ReadingState {
  recent: ReadingEntry[];
}

export interface ScrollProgressInput {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

export interface ScrollProgress {
  progress: number;
  scrollTop: number;
}

export type ReadingStatus = "unread" | "reading" | "read";

const EMPTY_READING_STATE: ReadingState = { recent: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function clampNumber(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function computeScrollProgress({
  scrollTop,
  scrollHeight,
  clientHeight,
}: ScrollProgressInput): ScrollProgress {
  const normalizedScrollTop = Math.max(0, scrollTop);
  const max = scrollHeight - clientHeight;
  const progress = max > 0 ? Math.min(100, (normalizedScrollTop / max) * 100) : 0;
  return { progress, scrollTop: normalizedScrollTop };
}

export function getReadingStatus(progress: number): ReadingStatus {
  if (progress >= 95) return "read";
  if (progress > 0) return "reading";
  return "unread";
}

/**
 * Human-facing label for a reading entry's status: "" when unread,
 * "reading NN%" while in progress, or "read" once finished (>= 95%).
 */
export function readingStatusLabel(progress: number): string {
  const status = getReadingStatus(progress);
  if (status === "read") return "read";
  if (status === "reading") return `reading ${Math.round(progress)}%`;
  return "";
}

function normalizeEntry(value: unknown): ReadingEntry | null {
  if (!isRecord(value)) return null;
  if (typeof value.href !== "string" || value.href.trim() === "") return null;
  if (!value.href.startsWith("/") || value.href.startsWith("//")) return null;
  if (typeof value.title !== "string" || value.title.trim() === "") return null;

  const path = typeof value.path === "string" ? value.path : "";
  const lastReadAt =
    typeof value.lastReadAt === "string" ? value.lastReadAt : new Date(0).toISOString();

  return {
    href: value.href,
    slug: normalizeStringArray(value.slug),
    title: value.title,
    path,
    lastReadAt,
    progress: clampNumber(value.progress, 0, 100),
    scrollTop: clampNumber(value.scrollTop, 0, Number.MAX_SAFE_INTEGER),
  };
}

function normalizeState(value: unknown): ReadingState {
  if (!isRecord(value) || !Array.isArray(value.recent)) {
    return { ...EMPTY_READING_STATE };
  }

  return {
    recent: value.recent
      .map(normalizeEntry)
      .filter((item): item is ReadingEntry => item !== null)
      .slice(0, MAX_RECENT_READINGS),
  };
}

export function upsertReadingEntry(
  list: readonly ReadingEntry[],
  entry: ReadingEntry,
  max: number = MAX_RECENT_READINGS
): ReadingEntry[] {
  const normalized = normalizeEntry(entry);
  if (!normalized) return [...list];

  const deduped = list.filter((item) => item.href !== normalized.href);
  return [normalized, ...deduped].slice(0, Math.max(0, max));
}

export function removeReadingEntry(list: readonly ReadingEntry[], href: string): ReadingEntry[] {
  return list.filter((item) => item.href !== href);
}

/**
 * Recent entries whose href is still available (present in `hrefs`), newest-first,
 * capped at `limit`. Entries are stored newest-first, so filtering preserves order.
 * Used to render "Continue Reading" against the current library so removed or stale
 * documents never surface.
 */
export function selectRecentInScope(
  entries: readonly ReadingEntry[],
  hrefs: Iterable<string>,
  limit: number = MAX_RECENT_READINGS
): ReadingEntry[] {
  const available = new Set(hrefs);
  return entries.filter((entry) => available.has(entry.href)).slice(0, Math.max(0, limit));
}

export function loadReadingState(): ReadingState {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ...EMPTY_READING_STATE };
  }

  try {
    const raw = window.localStorage.getItem(READING_STATE_KEY);
    if (!raw) return { ...EMPTY_READING_STATE };
    return normalizeState(JSON.parse(raw));
  } catch {
    return { ...EMPTY_READING_STATE };
  }
}

export function saveReadingState(state: ReadingState): void {
  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    window.localStorage.setItem(READING_STATE_KEY, JSON.stringify(normalizeState(state)));
  } catch {
    // Reading state is a convenience. Disabled/quota-limited storage should not
    // break reading.
  }
}

export function saveReadingEntry(entry: ReadingEntry): ReadingState {
  const current = loadReadingState();
  const next = { recent: upsertReadingEntry(current.recent, entry) };
  saveReadingState(next);
  notifyReadingStateChanged();
  return next;
}

export function deleteReadingEntry(href: string): ReadingState {
  const current = loadReadingState();
  const next = { recent: removeReadingEntry(current.recent, href) };
  saveReadingState(next);
  notifyReadingStateChanged();
  return next;
}

export function notifyReadingStateChanged(): void {
  if (typeof window === "undefined") return;
  const event =
    typeof StorageEvent === "function"
      ? new StorageEvent("storage", { key: READING_STATE_KEY })
      : new Event("storage");
  window.dispatchEvent(event);
}
