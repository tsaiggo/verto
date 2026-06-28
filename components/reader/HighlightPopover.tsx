"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  deleteAnnotation,
  setAnnotationColor,
  setAnnotationNote,
  type Annotation,
} from "@/lib/annotations";
import { ColorSwatches, type HighlightColor } from "@/components/reader/highlight-colors";

const POPOVER_WIDTH = 280;

export interface PopoverAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function HighlightPopover({
  annotation,
  anchor,
  onClose,
}: {
  annotation: Annotation;
  anchor: PopoverAnchor;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(annotation.note === "");
  const [draft, setDraft] = useState(annotation.note);
  const ref = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  function commit() {
    setAnnotationNote(annotation.id, draft.trim());
    setEditing(false);
  }

  function recolor(color: HighlightColor) {
    setAnnotationColor(annotation.id, color);
  }

  function remove() {
    deleteAnnotation(annotation.id);
    onClose();
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Highlight"
      className="highlight-popover animate-in fade-in-0 zoom-in-95 duration-150"
      style={{
        top: anchor.y + anchor.height + 8,
        left: clampLeft(anchor.x + anchor.width / 2 - POPOVER_WIDTH / 2),
      }}
    >
      <ColorSwatches value={annotation.color as HighlightColor} onChange={recolor} />

      {editing ? (
        <>
          <textarea
            ref={textareaRef}
            className="annotation-composer-input"
            placeholder="Write a note (optional)…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) commit();
            }}
            rows={3}
          />
          <div className="highlight-popover-foot">
            <button
              type="button"
              className="annotation-btn-ghost annotation-btn-danger"
              onClick={remove}
            >
              <Trash2 className="note-icon" aria-hidden />
              Delete
            </button>
            <button type="button" className="annotation-btn-primary" onClick={commit}>
              Save
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="highlight-popover-note">{annotation.note}</p>
          <div className="highlight-popover-foot">
            <button
              type="button"
              className="annotation-btn-ghost annotation-btn-danger"
              onClick={remove}
            >
              <Trash2 className="note-icon" aria-hidden />
              Delete
            </button>
            <button
              type="button"
              className="annotation-btn-ghost"
              onClick={() => {
                setDraft(annotation.note);
                setEditing(true);
              }}
            >
              <Pencil className="note-icon" aria-hidden />
              Edit
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function clampLeft(left: number): number {
  const margin = 8;
  const max = window.innerWidth - POPOVER_WIDTH - margin;
  return Math.max(margin, Math.min(left, max));
}
