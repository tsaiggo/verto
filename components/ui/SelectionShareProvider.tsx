"use client";

import { createContext, useContext, type ReactNode } from "react";
import { siteConfig } from "@/lib/site";
import { useArticleSelection } from "@/components/ui/use-article-selection";

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
  const selection = useArticleSelection(siteConfig.share.minTextLength);

  return (
    <SelectionShareContext.Provider
      value={{
        selectedText: selection.text,
        selectionRect: selection.rect,
        isActive: selection.isActive,
      }}
    >
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
