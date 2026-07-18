"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  annotationNote,
  deleteAnnotation,
  loadAnnotations,
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
  const note = annotationNote(annotation);
  const [editing, setEditing] = useState(note === "");
  const [draft, setDraft] = useState(note);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [recoloring, setRecoloring] = useState(false);
  const busy = saving || removing || recoloring;
  const ref = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!busy && ref.current && !ref.current.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, onClose]);

  async function commit() {
    if (busy) return;
    const nextNote = draft.trim();
    setSaving(true);
    try {
      await setAnnotationNote(annotation.id, nextNote);
      setEditing(false);
    } catch {
      const stored = loadAnnotations().annotations.find((item) => item.id === annotation.id);
      if (stored && annotationNote(stored) === nextNote) {
        setEditing(false);
        return;
      }
      toast.error("Couldn't save note", {
        description: "Your draft is still here. Check that local storage is available, then retry.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function recolor(color: HighlightColor) {
    if (busy || color === annotation.color) return;
    setRecoloring(true);
    try {
      await setAnnotationColor(annotation.id, color);
    } catch {
      const stored = loadAnnotations().annotations.find((item) => item.id === annotation.id);
      if (stored?.color === color) return;
      toast.error("Couldn't change highlight color", {
        description: "The previous color is still applied. Check local storage, then retry.",
      });
    } finally {
      setRecoloring(false);
    }
  }

  async function remove() {
    if (busy) return;
    setRemoving(true);
    try {
      await deleteAnnotation(annotation.id);
      onClose();
    } catch {
      const stillSaved = loadAnnotations().annotations.some((item) => item.id === annotation.id);
      if (!stillSaved) {
        onClose();
        return;
      }
      toast.error("Couldn't delete highlight", {
        description:
          "The highlight is still saved. Check that local storage is available, then retry.",
      });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Highlight"
      aria-busy={busy}
      className="highlight-popover animate-in fade-in-0 zoom-in-95 duration-150"
      style={{
        top: anchor.y + anchor.height + 8,
        left: clampLeft(anchor.x + anchor.width / 2 - POPOVER_WIDTH / 2),
      }}
    >
      <ColorSwatches
        value={annotation.color as HighlightColor}
        onChange={(color) => void recolor(color)}
        disabled={busy}
      />

      {editing ? (
        <>
          <textarea
            ref={textareaRef}
            className="annotation-composer-input"
            placeholder="Write a note (optional)…"
            value={draft}
            disabled={busy}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void commit();
              }
            }}
            rows={3}
          />
          <div className="highlight-popover-foot">
            <button
              type="button"
              className="annotation-btn-ghost annotation-btn-danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              <Trash2 className="note-icon" aria-hidden />
              {removing ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              className="annotation-btn-primary"
              disabled={busy}
              onClick={() => void commit()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="highlight-popover-note">{note}</p>
          <div className="highlight-popover-foot">
            <button
              type="button"
              className="annotation-btn-ghost annotation-btn-danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              <Trash2 className="note-icon" aria-hidden />
              {removing ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              className="annotation-btn-ghost"
              disabled={busy}
              onClick={() => {
                setDraft(note);
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
