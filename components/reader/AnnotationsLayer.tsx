"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { describeRange, locateAnchor, type TextAnchor } from "@/lib/annotation-anchor";
import {
  articleText,
  clearAnnotationHighlights,
  flashPaint,
  getArticleRoot,
  paintAnnotation,
  rangeToOffsets,
} from "@/lib/annotation-dom";
import { saveAnnotation } from "@/lib/annotations";
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
    return { anchor, rect: selectionRect };
  }, [selectionRect]);

  const persist = useCallback(
    (anchor: TextAnchor, note: string, color: HighlightColor) => {
      const id = crypto.randomUUID();
      freshIdRef.current = id;
      const now = new Date().toISOString();
      void saveAnnotation({
        id,
        docSlug,
        quote: anchor.quote,
        anchor,
        color,
        turns: note
          ? [{ id: crypto.randomUUID(), author: "human", body: note, createdAt: now }]
          : [],
        createdAt: now,
        updatedAt: now,
      }).catch(() => {});
      window.getSelection()?.removeAllRanges();
    },
    [docSlug]
  );

  const createHighlight = useCallback(() => {
    const captured = captureAnchor();
    if (captured) persist(captured.anchor, "", DEFAULT_HIGHLIGHT_COLOR);
  }, [captureAnchor, persist]);

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

  return (
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
    </>
  );
}
