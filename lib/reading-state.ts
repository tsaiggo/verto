import { getStateStore } from "@/lib/state-store";

/** Default number of recent documents surfaced by reading-history UIs. */
export const MAX_RECENT_READINGS = 5;

/** `localStorage` key for reading state (also mirrored as .verto/reading-state.json). */
export const READING_STATE_KEY = "verto:reading-state";

const READING_STATE_STORE_NAME = "reading-state";
export const READING_STATE_VERSION = 2 as const;

export interface ReadingEntry {
  href: string;
  slug: string[];
  title: string;
  path: string;
  lastReadAt: string;
  progress: number;
  scrollTop: number;
}

/**
 * Version 2 keeps every document entry independently from its recency order.
 * `recent` is a derived compatibility view for existing consumers; only
 * `version`, `byHref`, and `recentHrefs` are persisted.
 */
export interface ReadingState {
  version: typeof READING_STATE_VERSION;
  byHref: Record<string, ReadingEntry>;
  recentHrefs: string[];
  recent: ReadingEntry[];
}

/** Version 1 shape used by existing localStorage data and older callers. */
export interface LegacyReadingState {
  recent: ReadingEntry[];
}

export type ReadingStateInput = ReadingState | LegacyReadingState;

interface PersistedReadingStateV2 {
  version: typeof READING_STATE_VERSION;
  byHref: Record<string, ReadingEntry>;
  recentHrefs: string[];
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

function emptyReadingState(): ReadingState {
  return {
    version: READING_STATE_VERSION,
    byHref: {},
    recentHrefs: [],
    recent: [],
  };
}

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

function compareLastReadAt(a: ReadingEntry, b: ReadingEntry): number {
  const aTime = Date.parse(a.lastReadAt);
  const bTime = Date.parse(b.lastReadAt);
  const safeA = Number.isFinite(aTime) ? aTime : 0;
  const safeB = Number.isFinite(bTime) ? bTime : 0;
  return safeB - safeA;
}

function buildState(
  byHref: Record<string, ReadingEntry>,
  preferredOrder: readonly string[]
): ReadingState {
  const recentHrefs: string[] = [];
  const seen = new Set<string>();

  for (const href of preferredOrder) {
    if (typeof href !== "string" || seen.has(href) || !byHref[href]) continue;
    seen.add(href);
    recentHrefs.push(href);
  }

  const unordered = Object.values(byHref)
    .filter((entry) => !seen.has(entry.href))
    .sort(compareLastReadAt);
  for (const entry of unordered) {
    seen.add(entry.href);
    recentHrefs.push(entry.href);
  }

  return {
    version: READING_STATE_VERSION,
    byHref,
    recentHrefs,
    recent: recentHrefs.map((href) => byHref[href]),
  };
}

function normalizeState(value: unknown): ReadingState {
  if (!isRecord(value)) return emptyReadingState();

  const byHref: Record<string, ReadingEntry> = {};

  if (isRecord(value.byHref)) {
    for (const candidate of Object.values(value.byHref)) {
      const normalized = normalizeEntry(candidate);
      if (normalized) byHref[normalized.href] = normalized;
    }
  }

  // Merge the legacy compatibility array as well. This handles both the v1
  // localStorage shape and partially upgraded data without dropping entries.
  const legacyEntries = Array.isArray(value.recent)
    ? value.recent
        .map(normalizeEntry)
        .filter((candidate): candidate is ReadingEntry => candidate !== null)
    : [];
  for (const entry of legacyEntries) {
    if (!byHref[entry.href]) byHref[entry.href] = entry;
  }

  const preferredOrder = Array.isArray(value.recentHrefs)
    ? value.recentHrefs
    : legacyEntries.map((entry) => entry.href);
  return buildState(
    byHref,
    preferredOrder.filter((href): href is string => typeof href === "string")
  );
}

function persistedState(state: ReadingState): PersistedReadingStateV2 {
  return {
    version: READING_STATE_VERSION,
    byHref: state.byHref,
    recentHrefs: state.recentHrefs,
  };
}

/**
 * List-level helper retained for callers that explicitly need a capped recent
 * view. Persistence does not use this function and therefore never evicts a
 * document's saved progress.
 */
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
  return normalizeState(getStateStore().read<unknown>(READING_STATE_STORE_NAME, null));
}

/** Wait for a desktop vault restore, then return the normalized state. */
export async function hydrateReadingState(): Promise<ReadingState> {
  const store = getStateStore();
  await store.hydrate?.(READING_STATE_STORE_NAME);
  return normalizeState(store.read<unknown>(READING_STATE_STORE_NAME, null));
}

export async function saveReadingState(state: ReadingStateInput): Promise<ReadingState> {
  const normalized = normalizeState(state);
  const saved = await getStateStore().update<unknown>(READING_STATE_STORE_NAME, null, () =>
    persistedState(normalized)
  );
  return normalizeState(saved);
}

export async function saveReadingEntry(entry: ReadingEntry): Promise<ReadingState> {
  const normalized = normalizeEntry(entry);
  if (!normalized) return loadReadingState();

  const saved = await getStateStore().update<unknown>(READING_STATE_STORE_NAME, null, (value) => {
    const current = normalizeState(value);
    const byHref = { ...current.byHref, [normalized.href]: normalized };
    return persistedState(
      buildState(byHref, [
        normalized.href,
        ...current.recentHrefs.filter((href) => href !== normalized.href),
      ])
    );
  });
  return normalizeState(saved);
}

export async function deleteReadingEntry(href: string): Promise<ReadingState> {
  const saved = await getStateStore().update<unknown>(READING_STATE_STORE_NAME, null, (value) => {
    const current = normalizeState(value);
    const byHref = { ...current.byHref };
    delete byHref[href];
    return persistedState(
      buildState(
        byHref,
        current.recentHrefs.filter((candidate) => candidate !== href)
      )
    );
  });
  return normalizeState(saved);
}

export function notifyReadingStateChanged(): void {
  if (typeof window === "undefined") return;
  const event =
    typeof StorageEvent === "function"
      ? new StorageEvent("storage", { key: READING_STATE_KEY })
      : new Event("storage");
  window.dispatchEvent(event);
}
