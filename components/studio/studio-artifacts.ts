import { annotationNote, type Annotation } from "@/lib/annotations";
import type { SavedSummary } from "@/lib/summaries";
import { summaryPreview } from "@/lib/studio-cards";

export type StudioArtifactKind = "summary" | "note";
export type StudioView = "all" | "summaries" | "notes";

export interface StudioArtifact {
  key: string;
  kind: StudioArtifactKind;
  kindLabel: "Summary" | "Note";
  title: string;
  insight: string;
  preview: string;
  sourceTitle: string;
  sourceHref: string;
  sourceScope: string;
  citation: string | null;
  createdAt: string;
  model?: string;
}

function truncate(value: string, max: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function sourceTitleFromSlug(slug: string): string {
  const segment = slug.split("/").filter(Boolean).at(-1) ?? "Document";
  const decoded = (() => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  })();
  const words = decoded
    .replace(/\.(md|mdx)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return words ? words.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Document";
}

export function buildStudioArtifacts(
  summaries: readonly SavedSummary[],
  annotations: readonly Annotation[]
): StudioArtifact[] {
  const artifacts: StudioArtifact[] = summaries.map((summary) => ({
    key: `summary:${summary.href}`,
    kind: "summary",
    kindLabel: "Summary",
    title: summary.title,
    insight: summary.body,
    preview: summaryPreview(summary.body, 180),
    sourceTitle: summary.title,
    sourceHref: summary.href,
    sourceScope: summary.contextNote?.trim() || "Document-level summary",
    citation: null,
    createdAt: summary.createdAt,
    ...(summary.model ? { model: summary.model } : {}),
  }));

  for (const annotation of annotations) {
    const note = annotationNote(annotation).trim();
    if (!note) continue;
    artifacts.push({
      key: `note:${annotation.id}`,
      kind: "note",
      kindLabel: "Note",
      title: truncate(note, 80),
      insight: note,
      preview: truncate(annotation.quote, 180),
      sourceTitle: sourceTitleFromSlug(annotation.docSlug),
      sourceHref: `/read/${annotation.docSlug}`,
      sourceScope: "Exact saved passage",
      citation: annotation.quote.trim(),
      createdAt: annotation.updatedAt,
    });
  }

  return artifacts.sort((left, right) => {
    const leftTime = Date.parse(left.createdAt);
    const rightTime = Date.parse(right.createdAt);
    const safeLeft = Number.isNaN(leftTime) ? 0 : leftTime;
    const safeRight = Number.isNaN(rightTime) ? 0 : rightTime;
    return safeRight - safeLeft;
  });
}

export function filterStudioArtifacts(
  artifacts: readonly StudioArtifact[],
  view: StudioView
): StudioArtifact[] {
  if (view === "summaries") return artifacts.filter((artifact) => artifact.kind === "summary");
  if (view === "notes") return artifacts.filter((artifact) => artifact.kind === "note");
  return [...artifacts];
}

export function formatStudioDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}
