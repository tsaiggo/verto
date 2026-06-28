"use client";

import { useEffect, useRef, useState } from "react";
import {
  ColorSwatches,
  DEFAULT_HIGHLIGHT_COLOR,
  type HighlightColor,
} from "@/components/reader/highlight-colors";

const COMPOSER_WIDTH = 288;

export interface ComposerAnchor {
  quote: string;
  rect: { x: number; y: number; width: number; height: number };
}

export default function NoteComposer({
  anchor,
  onSave,
  onCancel,
}: {
  anchor: ComposerAnchor;
  onSave: (note: string, color: HighlightColor) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState("");
  const [color, setColor] = useState<HighlightColor>(DEFAULT_HIGHLIGHT_COLOR);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      role="dialog"
      aria-label="Add note"
      className="annotation-composer animate-in fade-in-0 zoom-in-95 duration-150"
      style={{
        top: anchor.rect.y + 8,
        left: clampLeft(anchor.rect.x + anchor.rect.width / 2 - COMPOSER_WIDTH / 2),
      }}
    >
      <p className="annotation-composer-quote">{anchor.quote}</p>
      <textarea
        ref={textareaRef}
        className="annotation-composer-input"
        placeholder="Write a note (optional)…"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) onSave(note.trim(), color);
        }}
        rows={3}
      />
      <div className="annotation-composer-foot">
        <ColorSwatches value={color} onChange={setColor} />
        <div className="annotation-composer-actions">
          <button type="button" className="annotation-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="annotation-btn-primary"
            onClick={() => onSave(note.trim(), color)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function clampLeft(left: number): number {
  const margin = 8;
  const max = window.innerWidth - COMPOSER_WIDTH - margin;
  return Math.max(margin, Math.min(left, max));
}
