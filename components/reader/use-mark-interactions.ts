"use client";

import { useEffect } from "react";
import { getArticleRoot, HIGHLIGHT_CLASS, markRect, setMarkLinked } from "@/lib/annotation-dom";
import {
  ANNOTATION_HOVER_EVENT,
  dispatchAnnotationHover,
} from "@/components/reader/annotation-events";

export interface MarkClickAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Wires the painted highlights to their reader controls: hovering a mark
 * cross-highlights its note row, clicking one opens its popover, and a row
 * hover (dispatched as ANNOTATION_HOVER_EVENT) is reflected back onto the mark.
 */
export function useMarkInteractions(onMarkClick: (id: string, anchor: MarkClickAnchor) => void) {
  useEffect(() => {
    const root = getArticleRoot();
    if (!root) return;

    function markIdFrom(event: Event): string | undefined {
      const target = event.target as HTMLElement | null;
      return target?.closest<HTMLElement>(`mark.${HIGHLIGHT_CLASS}`)?.dataset.annotationId;
    }

    function onOver(event: Event) {
      const id = markIdFrom(event);
      if (id) dispatchAnnotationHover(id, true);
    }
    function onOut(event: Event) {
      const id = markIdFrom(event);
      if (id) dispatchAnnotationHover(id, false);
    }
    function onClick(event: Event) {
      const id = markIdFrom(event);
      if (!id) return;
      const node = getArticleRoot();
      if (!node) return;
      const rect = markRect(node, id);
      if (!rect) return;
      onMarkClick(id, {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      });
    }

    root.addEventListener("mouseover", onOver);
    root.addEventListener("mouseout", onOut);
    root.addEventListener("click", onClick);
    return () => {
      root.removeEventListener("mouseover", onOver);
      root.removeEventListener("mouseout", onOut);
      root.removeEventListener("click", onClick);
    };
  }, [onMarkClick]);

  useEffect(() => {
    function onHover(event: Event) {
      const detail = (event as CustomEvent<{ id: string; on: boolean }>).detail;
      const root = getArticleRoot();
      if (root && detail) setMarkLinked(root, detail.id, detail.on);
    }
    window.addEventListener(ANNOTATION_HOVER_EVENT, onHover);
    return () => window.removeEventListener(ANNOTATION_HOVER_EVENT, onHover);
  }, []);
}
