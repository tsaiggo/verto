"use client";

import { useEffect, useRef, useState } from "react";

export interface ArticleSelection {
  text: string;
  rect: { x: number; y: number; width: number; height: number } | null;
  isActive: boolean;
}

const INACTIVE: ArticleSelection = { text: "", rect: null, isActive: false };

/**
 * Tracks the current text selection inside `[data-article]`, debounced and
 * filtered the same way the selection-share toolbar needs it (non-collapsed,
 * a minimum length, inside the article, never inside a code block). Returns the
 * page-space rect of the selection end so a floating control can anchor to it.
 * Parameterised by `minLength` so different features (share vs. annotate) can
 * require different selection sizes from one implementation.
 */
export function useArticleSelection(minLength: number): ArticleSelection {
  const [selection, setSelection] = useState<ArticleSelection>(INACTIVE);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function process() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelection(INACTIVE);
        return;
      }

      const text = sel.toString().trim();
      if (text.length < minLength) {
        setSelection(INACTIVE);
        return;
      }

      const range = sel.getRangeAt(0);
      const article = document.querySelector("[data-article]");
      if (!article || !article.contains(range.commonAncestorContainer)) {
        setSelection(INACTIVE);
        return;
      }

      const ancestor = range.commonAncestorContainer;
      const ancestorEl =
        ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentElement : (ancestor as Element);
      if (ancestorEl?.closest("pre")) {
        setSelection(INACTIVE);
        return;
      }

      const rects = range.getClientRects();
      if (rects.length === 0) {
        setSelection(INACTIVE);
        return;
      }

      const last = rects[rects.length - 1];
      setSelection({
        text,
        rect: {
          x: last.left + window.scrollX,
          y: last.bottom + window.scrollY,
          width: last.width,
          height: last.height,
        },
        isActive: true,
      });
    }

    function onSelectionChange() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(process, 200);
    }

    function onMouseUp() {
      setTimeout(process, 10);
    }

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("mouseup", onMouseUp);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [minLength]);

  return selection;
}
