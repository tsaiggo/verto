"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { describeRange, locateAnchor, type TextAnchor } from "@/lib/annotation-anchor";
import {
  articleText,
  clearAnnotationHighlights,
  flashPaint,
  getArticleRoot,
  markRect,
  paintAnnotation,
  rangeToOffsets,
} from "@/lib/annotation-dom";
import { saveAnnotation } from "@/lib/annotations";
import { localDocumentId } from "@/lib/local-library-storage";
import { DEFAULT_HIGHLIGHT_COLOR, type HighlightColor } from "@/components/reader/highlight-colors";
import { dispatchAskAI } from "@/lib/ai/ask-event";
import { getAssistantConfig } from "@/lib/ai";
import { useArticleSelection } from "@/components/ui/use-article-selection";
import { useDocAnnotations } from "@/components/reader/use-doc-annotations";
import {
  useMarkInteractions,
  type MarkClickAnchor,
} from "@/components/reader/use-mark-interactions";
import SelectionToolbar, { type ShareInfo } from "@/components/reader/SelectionToolbar";
import NoteComposer from "@/components/reader/NoteComposer";
import HighlightPopover, { type PopoverAnchor } from "@/components/reader/HighlightPopover";

const MIN_SELECTION = 3;

interface ComposerState {
  anchor: TextAnchor;
  rect: { x: number; y: number; width: number; height: number };
  range: Range;
}

interface PopoverState {
  id: string;
  anchor: PopoverAnchor;
}

export default function AnnotationsLayer({
  docSlug,
  share,
}: {
  docSlug: string;
  share: ShareInfo;
}) {
  const { rect: selectionRect, text: selectionText, isActive } = useArticleSelection(MIN_SELECTION);
  const annotations = useDocAnnotations(docSlug);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const freshIdRef = useRef<string | null>(null);

  const popoverAnnotation = popover
    ? (annotations.find((item) => item.id === popover.id) ?? null)
    : null;
  const popoverVisible = popover !== null && popoverAnnotation !== null;

  /* Repaint stored highlights on change, playing the marker wipe only on the
     highlight that was just created (clearing first keeps offsets stable). */
  useEffect(() => {
    const root = getArticleRoot();
    if (!root) return;
    clearAnnotationHighlights(root);
    const text = articleText(root);
    for (const annotation of annotations) {
      const location = locateAnchor(text, annotation.anchor);
      if (!location) continue;
      const marks = paintAnnotation(root, location, {
        id: annotation.id,
        color: annotation.color,
      });
      if (annotation.id === freshIdRef.current) {
        flashPaint(marks);
        freshIdRef.current = null;
      }
    }
    return () => {
      const current = getArticleRoot();
      if (current) clearAnnotationHighlights(current);
    };
  }, [annotations]);

  const openPopover = useCallback((id: string, anchor: MarkClickAnchor) => {
    setPopover({ id, anchor });
  }, []);
  useMarkInteractions(openPopover);

  const captureAnchor = useCallback((): ComposerState | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selectionRect) return null;
    const root = getArticleRoot();
    if (!root) return null;
    const offsets = rangeToOffsets(root, selection.getRangeAt(0));
    if (!offsets) return null;
    const anchor = describeRange(articleText(root), offsets.start, offsets.end);
    return { anchor, rect: selectionRect, range: selection.getRangeAt(0).cloneRange() };
  }, [selectionRect]);

  const composerRange = composer?.range;
  const popoverId = popover?.id;
  useEffect(() => {
    if (!composerRange && !popoverId) return;
    function reposition(event: Event) {
      if (
        event.target instanceof Element &&
        event.target.closest(".annotation-composer, .highlight-popover")
      )
        return;
      const rects = composerRange?.getClientRects();
      const end = rects?.[rects.length - 1];
      if (end) {
        setComposer((current) =>
          current
            ? {
                ...current,
                rect: {
                  x: end.left + window.scrollX,
                  y: end.bottom + window.scrollY,
                  width: end.width,
                  height: end.height,
                },
              }
            : current
        );
      }
      const article = getArticleRoot();
      const mark = article && popoverId ? markRect(article, popoverId) : null;
      if (mark) {
        setPopover((current) =>
          current
            ? {
                ...current,
                anchor: {
                  x: mark.left + window.scrollX,
                  y: mark.top + window.scrollY,
                  width: mark.width,
                  height: mark.height,
                },
              }
            : current
        );
      }
    }
    document.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [composerRange, popoverId]);

  const persist = useCallback(
    (anchor: TextAnchor, note: string, color: HighlightColor) => {
      const id = localDocumentId();
      freshIdRef.current = id;
      const now = new Date().toISOString();
      void saveAnnotation({
        id,
        docSlug,
        quote: anchor.quote,
        anchor,
        color,
        turns: note ? [{ id: localDocumentId(), author: "human", body: note, createdAt: now }] : [],
        createdAt: now,
        updatedAt: now,
      }).catch(() => {});
      window.getSelection()?.removeAllRanges();
    },
    [docSlug]
  );

  const createHighlight = useCallback(
    (color: HighlightColor = DEFAULT_HIGHLIGHT_COLOR) => {
      const captured = captureAnchor();
      if (captured) persist(captured.anchor, "", color);
    },
    [captureAnchor, persist]
  );

  const startNote = useCallback(() => {
    const captured = captureAnchor();
    if (captured) setComposer(captured);
  }, [captureAnchor]);

  const askEnabled = getAssistantConfig().enabled;
  const startAsk = useCallback(() => {
    if (!selectionText.trim()) return;
    dispatchAskAI(selectionText);
    window.getSelection()?.removeAllRanges();
  }, [selectionText]);

  /* Keyboard shortcuts on an active selection: H highlights, N opens a note. */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (composer || popoverVisible || !isActive) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      if (key === "h") {
        event.preventDefault();
        createHighlight();
      } else if (key === "n") {
        event.preventDefault();
        startNote();
      } else if (key === "a" && askEnabled) {
        event.preventDefault();
        startAsk();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isActive, composer, popoverVisible, createHighlight, startNote, startAsk, askEnabled]);

  const showToolbar = isActive && selectionRect !== null && !composer && !popoverVisible;

  if (!showToolbar && !composer && !popoverVisible) return null;

  // Selection and highlight anchors are in page space. Keep the overlays out
  // of the positioned, clipped reading pane so they share that coordinate space.
  return createPortal(
    <>
      {showToolbar && selectionRect && (
        <SelectionToolbar
          selection={{ rect: selectionRect, text: selectionText }}
          share={share}
          onHighlight={createHighlight}
          onNote={startNote}
          onAsk={askEnabled ? startAsk : undefined}
        />
      )}

      {composer && (
        <NoteComposer
          anchor={{ quote: composer.anchor.quote, rect: composer.rect }}
          onSave={(note, color) => {
            persist(composer.anchor, note, color);
            setComposer(null);
          }}
          onCancel={() => {
            setComposer(null);
            window.getSelection()?.removeAllRanges();
          }}
        />
      )}

      {popover && popoverAnnotation && (
        <HighlightPopover
          annotation={popoverAnnotation}
          anchor={popover.anchor}
          onClose={() => setPopover(null)}
        />
      )}
    </>,
    document.body
  );
}
