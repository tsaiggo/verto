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
  onSave: (note: string, color: HighlightColor) => Promise<void>;
  onCancel: () => void;
}) {
  const [note, setNote] = useState("");
  const [color, setColor] = useState<HighlightColor>(DEFAULT_HIGHLIGHT_COLOR);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel, saving]);

  async function submit() {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(note.trim(), color);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Add note"
      aria-busy={saving}
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
        disabled={saving}
        onChange={(event) => setNote(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          }
        }}
        rows={3}
      />
      <div className="annotation-composer-foot">
        <ColorSwatches value={color} onChange={setColor} disabled={saving} />
        <div className="annotation-composer-actions">
          <button
            type="button"
            className="annotation-btn-ghost"
            disabled={saving}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="annotation-btn-primary"
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving ? "Saving…" : "Save"}
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
