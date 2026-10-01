/** Shared actions between the contextual sidebar and the mounted editor. */
export const EDITOR_ACTION_EVENT = "verto:editor-action";
export const EDITOR_DOCUMENT_EVENT = "verto:editor-document";

export type EditorAction = "source" | "preview" | "save";
export interface EditorActionDetail {
  action: EditorAction;
}
export interface EditorDocumentDetail {
  filename: string;
  canSave: boolean;
}

export function requestEditorAction(action: EditorAction): void {
  window.dispatchEvent(
    new CustomEvent<EditorActionDetail>(EDITOR_ACTION_EVENT, { detail: { action } })
  );
}
