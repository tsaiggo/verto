/** Fired both ways to cross-highlight a note row and its passage on hover. */
export const ANNOTATION_HOVER_EVENT = "verto:annotation-hover";

export function dispatchAnnotationHover(id: string, on: boolean): void {
  window.dispatchEvent(new CustomEvent(ANNOTATION_HOVER_EVENT, { detail: { id, on } }));
}
