// Derives Knowledge Studio cards from the reader's saved artifacts: AI
// summaries (lib/summaries) and notes (lib/annotations with a human turn).
// Pure and dependency-light so it can be unit-tested without a DOM; the client
// component feeds it the two localStorage-backed lists.

import { annotationNote, type Annotation } from "@/lib/annotations";
import type { SavedSummary } from "@/lib/summaries";

export type StudioCardKind = "Summary" | "Note";

export interface StudioCard {
  /** Stable React key. */
  key: string;
  kind: StudioCardKind;
  title: string;
  desc: string;
  /** Deep-link back to the source document. */
  href: string;
  /** Stable identity in the underlying summary or annotation store. */
  artifactId: string;
  /** Full editable card content, not the truncated grid preview. */
  content: string;
  /** Source passage for a note card. */
  quote?: string;
  /** Epoch ms used for newest-first ordering (not rendered). */
  ts: number;
}

export type StudioCardFilter = "all" | "summary" | "note";

const INLINE_MARKDOWN = /[*_`>~]/g;

/** Flatten a Markdown summary body into a single trimmed, truncated preview line. */
export function summaryPreview(body: string, max = 160): string {
  const text = body
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [label](url) -> label
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/^\s*[-+*]\s+/gm, "") // list markers
    .replace(INLINE_MARKDOWN, "") // emphasis / inline code
    .replace(/\s+/g, " ") // collapse newlines + runs of whitespace
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

function toMs(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Build the Studio card set from saved summaries and annotations, newest-first.
 * Summaries become "Summary" cards; annotations that carry a note (a human
 * turn) become "Note" cards. Bare highlights (no note) are intentionally
 * excluded — they are not yet reusable knowledge.
 */
export function buildStudioCards(
  summaries: readonly SavedSummary[],
  annotations: readonly Annotation[]
): StudioCard[] {
  const cards: StudioCard[] = [];

  for (const summary of summaries) {
    cards.push({
      key: `summary:${summary.href}`,
      kind: "Summary",
      title: summary.title,
      desc: summaryPreview(summary.body),
      href: summary.href,
      artifactId: summary.href,
      content: summary.body,
      ts: toMs(summary.createdAt),
    });
  }

  for (const annotation of annotations) {
    const note = annotationNote(annotation).trim();
    if (!note) continue;
    cards.push({
      key: `note:${annotation.id}`,
      kind: "Note",
      title: truncate(note, 80),
      desc: truncate(annotation.quote, 160),
      href: `/read/${annotation.docSlug}`,
      artifactId: annotation.id,
      content: note,
      quote: annotation.quote,
      ts: toMs(annotation.updatedAt),
    });
  }

  return cards.sort((a, b) => b.ts - a.ts);
}

/** Case-insensitive, content-aware filtering for the real Studio toolbar. */
export function filterStudioCards(
  cards: readonly StudioCard[],
  query: string,
  filter: StudioCardFilter
): StudioCard[] {
  const needle = query.trim().toLocaleLowerCase();
  return cards.filter((card) => {
    if (filter !== "all" && card.kind.toLocaleLowerCase() !== filter) return false;
    if (!needle) return true;
    return [card.title, card.desc, card.content, card.quote ?? ""].some((value) =>
      value.toLocaleLowerCase().includes(needle)
    );
  });
}

/** Plain-text representation used by Studio's working copy action. */
export function studioCardCopyText(card: StudioCard): string {
  if (card.kind === "Note") {
    return card.quote ? `${card.content}\n\nQuoted passage:\n${card.quote}` : card.content;
  }
  return `${card.title}\n\n${card.content}`;
}
