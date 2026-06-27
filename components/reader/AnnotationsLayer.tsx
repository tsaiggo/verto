"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StickyNote } from "lucide-react";
import { describeRange, locateAnchor, type TextAnchor } from "@/lib/annotation-anchor";
import {
  articleText,
  clearAnnotationHighlights,
  getArticleRoot,
  HIGHLIGHT_CLASS,
  paintAnnotation,
  rangeToOffsets,
} from "@/lib/annotation-dom";
import { saveAnnotation } from "@/lib/annotations";
import { useArticleSelection } from "@/components/ui/use-article-selection";
import { useDocAnnotations } from "@/components/reader/use-doc-annotations";

/** Event the panel listens for when a reader clicks a painted highlight. */
export const ANNOTATION_FOCUS_EVENT = "verto:annotation-focus";

const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink"] as const;
type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

interface PendingNote {
  anchor: TextAnchor;
  /** Page-space anchor rect captured at click time, so the composer stays put. */
  rect: { x: number; y: number; width: number; height: number };
}

const COMPOSER_WIDTH = 288;

// Deliberately lower than the share toolbar's minimum so single terms highlight.
const ANNOTATION_MIN_SELECTION = 3;

export default function AnnotationsLayer({ docSlug }: { docSlug: string }) {
  const { rect: selectionRect, isActive } = useArticleSelection(ANNOTATION_MIN_SELECTION);
  const annotations = useDocAnnotations(docSlug);
  const [pending, setPending] = useState<PendingNote | null>(null);
  const [note, setNote] = useState("");
  const [color, setColor] = useState<HighlightColor>("yellow");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Repaint every stored highlight whenever the set changes (mount, add,
     edit, delete, or a change in another tab). Clearing first keeps offsets
     measured against the document's original text. */
  useEffect(() => {
    const root = getArticleRoot();
    if (!root) return;
    clearAnnotationHighlights(root);
    const text = articleText(root);
    for (const annotation of annotations) {
      const location = locateAnchor(text, annotation.anchor);
      if (location) {
        paintAnnotation(root, location, { id: annotation.id, color: annotation.color });
      }
    }
    return () => {
      const current = getArticleRoot();
      if (current) clearAnnotationHighlights(current);
    };
  }, [annotations]);

  /* Clicking a highlight asks the notes panel to reveal its entry. */
  useEffect(() => {
    const root = getArticleRoot();
    if (!root) return;
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const mark = target?.closest<HTMLElement>(`mark.${HIGHLIGHT_CLASS}`);
      const id = mark?.dataset.annotationId;
      if (!id) return;
      window.dispatchEvent(new CustomEvent(ANNOTATION_FOCUS_EVENT, { detail: { id } }));
    }
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (pending) textareaRef.current?.focus();
  }, [pending]);

  const openComposer = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selectionRect) return;
    const root = getArticleRoot();
    if (!root) return;
    const offsets = rangeToOffsets(root, selection.getRangeAt(0));
    if (!offsets) return;
    const anchor = describeRange(articleText(root), offsets.start, offsets.end);
    setPending({ anchor, rect: selectionRect });
    setNote("");
    setColor("yellow");
  }, [selectionRect]);

  const closeComposer = useCallback(() => {
    setPending(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const save = useCallback(() => {
    if (!pending) return;
    saveAnnotation({
      id: crypto.randomUUID(),
      docSlug,
      quote: pending.anchor.quote,
      note: note.trim(),
      anchor: pending.anchor,
      color,
      createdAt: new Date().toISOString(),
    });
    closeComposer();
  }, [pending, docSlug, note, color, closeComposer]);

  useEffect(() => {
    if (!pending) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeComposer();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pending, closeComposer]);

  const showButton = isActive && selectionRect !== null && pending === null;

  return (
    <>
      {showButton && selectionRect && (
        <button
          type="button"
          data-annotation-add
          className="annotation-add-btn animate-in fade-in-0 zoom-in-95 duration-150"
          style={{
            top: selectionRect.y + 8,
            left: clampLeft(selectionRect.x + selectionRect.width / 2 - 52, 104),
          }}
          onMouseDown={(event) => {
            event.preventDefault();
            openComposer();
          }}
        >
          <StickyNote className="annotation-add-icon" aria-hidden />
          Add note
        </button>
      )}

      {pending && (
        <div
          role="dialog"
          aria-label="Add note"
          className="annotation-composer animate-in fade-in-0 zoom-in-95 duration-150"
          style={{
            top: pending.rect.y + 8,
            left: clampLeft(
              pending.rect.x + pending.rect.width / 2 - COMPOSER_WIDTH / 2,
              COMPOSER_WIDTH
            ),
          }}
        >
          <p className="annotation-composer-quote">{pending.anchor.quote}</p>
          <textarea
            ref={textareaRef}
            className="annotation-composer-input"
            placeholder="Add a note (optional)…"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
          />
          <div className="annotation-composer-foot">
            <div className="annotation-swatches" role="radiogroup" aria-label="Highlight color">
              {HIGHLIGHT_COLORS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={color === key}
                  aria-label={key}
                  data-color={key}
                  data-selected={color === key}
                  className="annotation-swatch"
                  onClick={() => setColor(key)}
                />
              ))}
            </div>
            <div className="annotation-composer-actions">
              <button type="button" className="annotation-btn-ghost" onClick={closeComposer}>
                Cancel
              </button>
              <button type="button" className="annotation-btn-primary" onClick={save}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Keep a floating element of `width` inside the viewport with an 8px margin. */
function clampLeft(left: number, width: number): number {
  const margin = 8;
  const max = window.innerWidth - width - margin;
  return Math.max(margin, Math.min(left, max));
}
