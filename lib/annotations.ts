// Local persistence for reader-created annotations. An annotation is a
// passage anchor plus a list of conversation `turns`: [] is a bare highlight,
// [human] is a note, and [human, ai, ...] is a co-reading thread. SSR-guarded
// localStorage access with same-tab change notifications.

import type { TextAnchor } from "@/lib/annotation-anchor";

export const MAX_ANNOTATIONS = 2000;
export const ANNOTATIONS_KEY = "verto:annotations";

export type TurnAuthor = "human" | "ai";

export interface Turn {
  id: string;
  author: TurnAuthor;
  body: string;
  createdAt: string;
  /** Present for AI turns: the model that produced the reply. */
  model?: string;
}

export interface Annotation {
  id: string;
  docSlug: string;
  quote: string;
  anchor: TextAnchor;
  color: string;
  /** [] = bare highlight, [human] = a note, [human, ai, ...] = a thread. */
  turns: Turn[];
  createdAt: string;
  /** Bumped on every mutation; the basis for future cross-device merge. */
  updatedAt: string;
}

export interface AnnotationsState {
  annotations: Annotation[];
}

const EMPTY_STATE: AnnotationsState = { annotations: [] };

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through to the non-crypto id below.
  }
  return `t-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

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

function normalizeTurn(value: unknown, fallbackCreatedAt: string, fallbackId: string): Turn | null {
  if (!isRecord(value)) return null;
  if (typeof value.body !== "string") return null;
  const author: TurnAuthor = value.author === "ai" ? "ai" : "human";
  const turn: Turn = {
    id: isNonEmptyString(value.id) ? value.id : fallbackId,
    author,
    body: value.body,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : fallbackCreatedAt,
  };
  if (author === "ai" && isNonEmptyString(value.model)) turn.model = value.model;
  return turn;
}

// Reads `turns` when present; otherwise migrates a legacy `{ note }` record:
// a non-empty note becomes one human turn, an empty note becomes a bare highlight.
// Fallback ids are derived from the annotation id, never random, so repeated
// loads are byte-identical (useSyncExternalStore needs a stable snapshot).
function normalizeTurns(value: Record<string, unknown>, fallbackCreatedAt: string): Turn[] {
  const annotationId = typeof value.id === "string" ? value.id : "anno";
  if (Array.isArray(value.turns)) {
    return value.turns
      .map((turn, index) => normalizeTurn(turn, fallbackCreatedAt, `${annotationId}~t${index}`))
      .filter((turn): turn is Turn => turn !== null);
  }
  if (typeof value.note === "string" && value.note !== "") {
    return [
      { id: `${annotationId}~h0`, author: "human", body: value.note, createdAt: fallbackCreatedAt },
    ];
  }
  return [];
}

function normalizeAnnotation(value: unknown): Annotation | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.id)) return null;
  if (!isNonEmptyString(value.docSlug)) return null;
  if (!isNonEmptyString(value.quote)) return null;
  const anchor = normalizeAnchor(value.anchor);
  if (!anchor) return null;

  const createdAt =
    typeof value.createdAt === "string" ? value.createdAt : new Date(0).toISOString();
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;

  return {
    id: value.id,
    docSlug: value.docSlug,
    quote: value.quote,
    anchor,
    color: typeof value.color === "string" && value.color !== "" ? value.color : "yellow",
    turns: normalizeTurns(value, createdAt),
    createdAt,
    updatedAt,
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

/** The reader's note for an annotation: the first human turn's body, or "". */
export function annotationNote(annotation: Annotation): string {
  const turn = annotation.turns.find((item) => item.author === "human");
  return turn ? turn.body : "";
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

function withNote(annotation: Annotation, note: string, updatedAt: string): Annotation {
  const turns = [...annotation.turns];
  const index = turns.findIndex((turn) => turn.author === "human");
  if (index >= 0) {
    turns[index] = { ...turns[index], body: note };
  } else if (note !== "") {
    turns.unshift({ id: newId(), author: "human", body: note, createdAt: updatedAt });
  }
  return { ...annotation, turns, updatedAt };
}

export function updateAnnotationNote(
  list: readonly Annotation[],
  id: string,
  note: string,
  updatedAt: string = nowIso()
): Annotation[] {
  return list.map((item) => (item.id === id ? withNote(item, note, updatedAt) : item));
}

export function updateAnnotationColor(
  list: readonly Annotation[],
  id: string,
  color: string,
  updatedAt: string = nowIso()
): Annotation[] {
  return list.map((item) => (item.id === id ? { ...item, color, updatedAt } : item));
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

export function setAnnotationColor(id: string, color: string): AnnotationsState {
  const next = { annotations: updateAnnotationColor(loadAnnotations().annotations, id, color) };
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
