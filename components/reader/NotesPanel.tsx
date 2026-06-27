"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { deleteAnnotation, setAnnotationNote, type Annotation } from "@/lib/annotations";
import { getArticleRoot, scrollToAnnotation } from "@/lib/annotation-dom";
import { ANNOTATION_FOCUS_EVENT } from "@/components/reader/AnnotationsLayer";
import { useDocAnnotations } from "@/components/reader/use-doc-annotations";

export default function NotesPanel({ docSlug }: { docSlug: string }) {
  const annotations = useDocAnnotations(docSlug);
  const listRef = useRef<HTMLUListElement>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  /* Reveal and flash the matching entry when its highlight is clicked. */
  useEffect(() => {
    function onFocus(event: Event) {
      const id = (event as CustomEvent<{ id: string }>).detail?.id;
      if (!id) return;
      setFocusedId(id);
      const row = listRef.current?.querySelector<HTMLElement>(`[data-entry="${CSS.escape(id)}"]`);
      row?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      window.setTimeout(() => setFocusedId((current) => (current === id ? null : current)), 1200);
    }
    window.addEventListener(ANNOTATION_FOCUS_EVENT, onFocus);
    return () => window.removeEventListener(ANNOTATION_FOCUS_EVENT, onFocus);
  }, []);

  return (
    <section className="rail-panel notes-panel" aria-label="Notes">
      <div className="notes-panel-head">
        <span className="notes-panel-title">Notes</span>
        {annotations.length > 0 && <span className="notes-panel-count">{annotations.length}</span>}
      </div>

      {annotations.length === 0 ? (
        <p className="notes-panel-empty">
          Select any text in the document to highlight it and add a note.
        </p>
      ) : (
        <ul ref={listRef} className="notes-list">
          {annotations.map((annotation) => (
            <NoteRow
              key={annotation.id}
              annotation={annotation}
              focused={annotation.id === focusedId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function NoteRow({ annotation, focused }: { annotation: Annotation; focused: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(annotation.note);

  function jump() {
    const root = getArticleRoot();
    if (root) scrollToAnnotation(root, annotation.id);
  }

  function commit() {
    setAnnotationNote(annotation.id, draft.trim());
    setEditing(false);
  }

  return (
    <li className="note-row" data-entry={annotation.id} data-focused={focused}>
      <button type="button" className="note-quote" data-color={annotation.color} onClick={jump}>
        <span className="note-quote-bar" data-color={annotation.color} aria-hidden />
        {annotation.quote}
      </button>

      {editing ? (
        <div className="note-edit">
          <textarea
            className="note-edit-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            autoFocus
          />
          <div className="note-edit-actions">
            <button type="button" className="note-icon-btn" aria-label="Save note" onClick={commit}>
              <Check className="note-icon" aria-hidden />
            </button>
            <button
              type="button"
              className="note-icon-btn"
              aria-label="Cancel"
              onClick={() => {
                setDraft(annotation.note);
                setEditing(false);
              }}
            >
              <X className="note-icon" aria-hidden />
            </button>
          </div>
        </div>
      ) : (
        <div className="note-body">
          {annotation.note ? (
            <p className="note-text">{annotation.note}</p>
          ) : (
            <p className="note-text note-text-empty">No note</p>
          )}
          <div className="note-actions">
            <button
              type="button"
              className="note-icon-btn"
              aria-label="Edit note"
              onClick={() => {
                setDraft(annotation.note);
                setEditing(true);
              }}
            >
              <Pencil className="note-icon" aria-hidden />
            </button>
            <button
              type="button"
              className="note-icon-btn note-icon-danger"
              aria-label="Delete note"
              onClick={() => deleteAnnotation(annotation.id)}
            >
              <Trash2 className="note-icon" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
