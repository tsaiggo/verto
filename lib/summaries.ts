// Local persistence for AI-generated document summaries.
//
// Summaries are saved per document, keyed by the same internal `href` the
// reading-state store uses, so a summary is bound to exactly one readable
// page. This mirrors `lib/reading-state.ts`: a pure, dependency-free module
// with SSR-guarded `localStorage` access and same-tab change notifications.
//
// v0 keeps the latest summary per document (regenerating overwrites the
// previous one). Cross-document summaries accumulate up to a generous cap so
// a long reading history can't grow `localStorage` without bound.

/** Maximum number of per-document summaries to retain. */
export const MAX_SAVED_SUMMARIES = 200;

/** `localStorage` key for saved AI summaries. */
export const SUMMARIES_KEY = "verto:summaries";

export interface SavedSummary {
  href: string;
  slug: string[];
  title: string;
  /** Summary body as Markdown. */
  body: string;
  /** Identifier of the model that produced the summary. */
  model: string;
  /** ISO-8601 timestamp of when the summary was generated. */
  createdAt: string;
}

export interface SummariesState {
  summaries: SavedSummary[];
}

const EMPTY_SUMMARIES_STATE: SummariesState = { summaries: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeSummary(value: unknown): SavedSummary | null {
  if (!isRecord(value)) return null;
  if (typeof value.href !== "string" || value.href.trim() === "") return null;
  // Only accept internal, single-leading-slash paths (rejects `javascript:`
  // URLs and protocol-relative `//host` hrefs).
  if (!value.href.startsWith("/") || value.href.startsWith("//")) return null;
  if (typeof value.title !== "string" || value.title.trim() === "") return null;
  // An empty summary body carries no information; treat it as invalid.
  if (typeof value.body !== "string" || value.body.trim() === "") return null;

  const model = typeof value.model === "string" ? value.model : "";
  const createdAt =
    typeof value.createdAt === "string"
      ? value.createdAt
      : new Date(0).toISOString();

  return {
    href: value.href,
    slug: normalizeStringArray(value.slug),
    title: value.title,
    body: value.body,
    model,
    createdAt,
  };
}

function normalizeState(value: unknown): SummariesState {
  if (!isRecord(value) || !Array.isArray(value.summaries)) {
    return { ...EMPTY_SUMMARIES_STATE };
  }

  return {
    summaries: value.summaries
      .map(normalizeSummary)
      .filter((item): item is SavedSummary => item !== null)
      .slice(0, MAX_SAVED_SUMMARIES),
  };
}

export function upsertSummary(
  list: readonly SavedSummary[],
  summary: SavedSummary,
  max: number = MAX_SAVED_SUMMARIES,
): SavedSummary[] {
  const normalized = normalizeSummary(summary);
  if (!normalized) return [...list];

  const deduped = list.filter((item) => item.href !== normalized.href);
  return [normalized, ...deduped].slice(0, Math.max(0, max));
}

export function removeSummary(
  list: readonly SavedSummary[],
  href: string,
): SavedSummary[] {
  return list.filter((item) => item.href !== href);
}

export function findSummary(
  list: readonly SavedSummary[],
  href: string,
): SavedSummary | null {
  return list.find((item) => item.href === href) ?? null;
}

export function loadSummaries(): SummariesState {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ...EMPTY_SUMMARIES_STATE };
  }

  try {
    const raw = window.localStorage.getItem(SUMMARIES_KEY);
    if (!raw) return { ...EMPTY_SUMMARIES_STATE };
    return normalizeState(JSON.parse(raw));
  } catch {
    return { ...EMPTY_SUMMARIES_STATE };
  }
}

export function saveSummaries(state: SummariesState): void {
  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    window.localStorage.setItem(
      SUMMARIES_KEY,
      JSON.stringify(normalizeState(state)),
    );
  } catch {
    // Saved summaries are a convenience. Disabled or quota-limited storage
    // should never break reading.
  }
}

export function saveSummary(summary: SavedSummary): SummariesState {
  const current = loadSummaries();
  const next = { summaries: upsertSummary(current.summaries, summary) };
  saveSummaries(next);
  notifySummariesChanged();
  return next;
}

export function deleteSummary(href: string): SummariesState {
  const current = loadSummaries();
  const next = { summaries: removeSummary(current.summaries, href) };
  saveSummaries(next);
  notifySummariesChanged();
  return next;
}

export function notifySummariesChanged(): void {
  if (typeof window === "undefined") return;
  const event =
    typeof StorageEvent === "function"
      ? new StorageEvent("storage", { key: SUMMARIES_KEY })
      : new Event("storage");
  window.dispatchEvent(event);
}
