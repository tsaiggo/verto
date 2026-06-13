"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { siteConfig } from "@/lib/site";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectionShareContextValue {
  selectedText: string;
  selectionRect: SelectionRect | null;
  isActive: boolean;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const SelectionShareContext = createContext<SelectionShareContextValue>({
  selectedText: "",
  selectionRect: null,
  isActive: false,
});

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export default function SelectionShareProvider({ children }: { children: ReactNode }) {
  const [selectedText, setSelectedText] = useState("");
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [isActive, setIsActive] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Core selection processing ───────────────────────────────────── */
  const processSelection = useCallback(() => {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setIsActive(false);
      return;
    }

    const text = selection.toString().trim();
    if (text.length < siteConfig.share.minTextLength) {
      setIsActive(false);
      return;
    }

    const range = selection.getRangeAt(0);

    /* Verify selection is within [data-article] */
    const articleEl = document.querySelector("[data-article]");
    if (!articleEl || !articleEl.contains(range.commonAncestorContainer)) {
      setIsActive(false);
      return;
    }

    /* Exclude selections inside <pre> (code blocks) */
    const ancestor = range.commonAncestorContainer;
    const ancestorEl =
      ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentElement : (ancestor as Element);
    if (ancestorEl?.closest("pre")) {
      setIsActive(false);
      return;
    }

    /* Get position from last client rect (near end of selection) */
    const rects = range.getClientRects();
    if (rects.length === 0) {
      setIsActive(false);
      return;
    }

    const lastRect = rects[rects.length - 1];
    setSelectedText(text);
    setSelectionRect({
      x: lastRect.left + window.scrollX,
      y: lastRect.bottom + window.scrollY,
      width: lastRect.width,
      height: lastRect.height,
    });
    setIsActive(true);
  }, []);

  /* ── Event listeners ─────────────────────────────────────────────── */
  useEffect(() => {
    /* Debounced selectionchange handler (~200ms) */
    function onSelectionChange() {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(processSelection, 200);
    }

    /* Mouseup handler with short delay for immediate feedback */
    function onMouseUp() {
      setTimeout(processSelection, 10);
    }

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("mouseup", onMouseUp);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [processSelection]);

  return (
    <SelectionShareContext.Provider value={{ selectedText, selectionRect, isActive }}>
      {children}
    </SelectionShareContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useSelectionShare() {
  return useContext(SelectionShareContext);
}
