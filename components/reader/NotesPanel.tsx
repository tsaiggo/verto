"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import {
  annotationNote,
  deleteAnnotation,
  setAnnotationNote,
  type Annotation,
} from "@/lib/annotations";
import { getArticleRoot, scrollToAnnotation } from "@/lib/annotation-dom";
import {
  ANNOTATION_HOVER_EVENT,
  dispatchAnnotationHover,
} from "@/components/reader/annotation-events";
import { useDocAnnotations } from "@/components/reader/use-doc-annotations";

export default function NotesPanel({ docSlug }: { docSlug: string }) {
  const annotations = useDocAnnotations(docSlug);
  const [linkedId, setLinkedId] = useState<string | null>(null);

  /* Light up the row whose passage is hovered in the article. */
  useEffect(() => {
    function onHover(event: Event) {
      const detail = (event as CustomEvent<{ id: string; on: boolean }>).detail;
      if (!detail) return;
      setLinkedId((current) => (detail.on ? detail.id : current === detail.id ? null : current));
    }
    window.addEventListener(ANNOTATION_HOVER_EVENT, onHover);
    return () => window.removeEventListener(ANNOTATION_HOVER_EVENT, onHover);
  }, []);

  return (
    <section className="rail-panel notes-panel" aria-label="Notes">
      <div className="notes-panel-head">
        <span className="notes-panel-title">Notes</span>
        {annotations.length > 0 && <span className="notes-panel-count">{annotations.length}</span>}
      </div>

      {annotations.length === 0 ? (
        <p className="notes-panel-empty">
          Select any text to highlight it. Press H to highlight, N to add a note.
        </p>
      ) : (
        <ul className="notes-list">
          {annotations.map((annotation) => (
            <NoteRow
              key={annotation.id}
              annotation={annotation}
              linked={annotation.id === linkedId}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function NoteRow({ annotation, linked }: { annotation: Annotation; linked: boolean }) {
  const [editing, setEditing] = useState(false);
  const note = annotationNote(annotation);
  const [draft, setDraft] = useState(note);

  function jump() {
    const root = getArticleRoot();
    if (root) scrollToAnnotation(root, annotation.id);
  }

  function commit() {
    setAnnotationNote(annotation.id, draft.trim());
    setEditing(false);
  }

  return (
    <li
      className="note-row"
      data-entry={annotation.id}
      data-linked={linked}
      onMouseEnter={() => dispatchAnnotationHover(annotation.id, true)}
      onMouseLeave={() => dispatchAnnotationHover(annotation.id, false)}
    >
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
                setDraft(note);
                setEditing(false);
              }}
            >
              <X className="note-icon" aria-hidden />
            </button>
          </div>
        </div>
      ) : (
        <div className="note-body">
          {note ? (
            <p className="note-text">{note}</p>
          ) : (
            <p className="note-text note-text-empty">No note</p>
          )}
          <div className="note-actions">
            <button
              type="button"
              className="note-icon-btn"
              aria-label="Edit note"
              onClick={() => {
                setDraft(note);
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
