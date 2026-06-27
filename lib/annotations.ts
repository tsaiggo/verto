// Local persistence for reader-created annotations (highlights + notes).
//
// Mirrors lib/subscriptions.ts: a pure, dependency-free store with SSR-guarded
// localStorage access and same-tab change notifications. Annotations are keyed
// by their owning document slug and carry a text-quote anchor (see
// lib/annotation-anchor) so a highlight can be repainted on a later visit.

import type { TextAnchor } from "@/lib/annotation-anchor";

export const MAX_ANNOTATIONS = 2000;
export const ANNOTATIONS_KEY = "verto:annotations";

export interface Annotation {
  /** Unique id, generated when the annotation is created. */
  id: string;
  /** Slug of the document this annotation belongs to. */
  docSlug: string;
  /** The highlighted text. */
  quote: string;
  /** The reader's note (empty for a highlight with no comment). */
  note: string;
  /** Text-quote anchor used to re-locate the highlight in the document. */
  anchor: TextAnchor;
  /** Highlight color key. */
  color: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}

export interface AnnotationsState {
  annotations: Annotation[];
}

const EMPTY_STATE: AnnotationsState = { annotations: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function normalizeAnchor(value: unknown): TextAnchor | null {
  if (!isRecord(value)) return null;
  if (typeof value.quote !== "string" || value.quote === "") return null;
  if (typeof value.prefix !== "string" || typeof value.suffix !== "string") return null;
  if (typeof value.start !== "number") return null;
  return { quote: value.quote, prefix: value.prefix, suffix: value.suffix, start: value.start };
}

function normalizeAnnotation(value: unknown): Annotation | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.id)) return null;
  if (!isNonEmptyString(value.docSlug)) return null;
  if (!isNonEmptyString(value.quote)) return null;
  const anchor = normalizeAnchor(value.anchor);
  if (!anchor) return null;

  return {
    id: value.id,
    docSlug: value.docSlug,
    quote: value.quote,
    note: typeof value.note === "string" ? value.note : "",
    anchor,
    color: typeof value.color === "string" && value.color !== "" ? value.color : "yellow",
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString(),
  };
}

function normalizeState(value: unknown): AnnotationsState {
  if (!isRecord(value) || !Array.isArray(value.annotations)) {
    return { ...EMPTY_STATE };
  }
  return {
    annotations: value.annotations
      .map(normalizeAnnotation)
      .filter((item): item is Annotation => item !== null)
      .slice(0, MAX_ANNOTATIONS),
  };
}

export function upsertAnnotation(
  list: readonly Annotation[],
  annotation: Annotation,
  max: number = MAX_ANNOTATIONS
): Annotation[] {
  const normalized = normalizeAnnotation(annotation);
  if (!normalized) return [...list];
  const deduped = list.filter((item) => item.id !== normalized.id);
  return [normalized, ...deduped].slice(0, Math.max(0, max));
}

export function updateAnnotationNote(
  list: readonly Annotation[],
  id: string,
  note: string
): Annotation[] {
  return list.map((item) => (item.id === id ? { ...item, note } : item));
}

export function removeAnnotation(list: readonly Annotation[], id: string): Annotation[] {
  return list.filter((item) => item.id !== id);
}

export function annotationsForDoc(list: readonly Annotation[], docSlug: string): Annotation[] {
  return list.filter((item) => item.docSlug === docSlug);
}

export function loadAnnotations(): AnnotationsState {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ...EMPTY_STATE };
  }
  try {
    const raw = window.localStorage.getItem(ANNOTATIONS_KEY);
    if (!raw) return { ...EMPTY_STATE };
    return normalizeState(JSON.parse(raw));
  } catch {
    return { ...EMPTY_STATE };
  }
}

export function saveAnnotations(state: AnnotationsState): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(normalizeState(state)));
  } catch {
    // Annotations are a convenience; disabled or quota-limited storage must
    // never break reading.
  }
}

export function saveAnnotation(annotation: Annotation): AnnotationsState {
  const next = { annotations: upsertAnnotation(loadAnnotations().annotations, annotation) };
  saveAnnotations(next);
  notifyAnnotationsChanged();
  return next;
}

export function deleteAnnotation(id: string): AnnotationsState {
  const next = { annotations: removeAnnotation(loadAnnotations().annotations, id) };
  saveAnnotations(next);
  notifyAnnotationsChanged();
  return next;
}

export function setAnnotationNote(id: string, note: string): AnnotationsState {
  const next = { annotations: updateAnnotationNote(loadAnnotations().annotations, id, note) };
  saveAnnotations(next);
  notifyAnnotationsChanged();
  return next;
}

export function notifyAnnotationsChanged(): void {
  if (typeof window === "undefined") return;
  const event =
    typeof StorageEvent === "function"
      ? new StorageEvent("storage", { key: ANNOTATIONS_KEY })
      : new Event("storage");
  window.dispatchEvent(event);
}
