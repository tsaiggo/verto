"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

interface InlineCommentContextValue {
  comments: Map<string, ReactNode>;
  registerComment: (id: string, content: ReactNode) => void;
}

const InlineCommentContext = createContext<InlineCommentContextValue>({
  comments: new Map(),
  registerComment: () => {},
});

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export default function InlineCommentProvider({ children }: { children: ReactNode }) {
  const [comments, setComments] = useState<Map<string, ReactNode>>(() => new Map());

  const registerComment = useCallback((id: string, content: ReactNode) => {
    setComments((prev) => {
      /* Skip update if key already present — avoids infinite loops */
      if (prev.has(id)) return prev;
      const next = new Map(prev);
      next.set(id, content);
      return next;
    });
  }, []);

  return (
    <InlineCommentContext.Provider value={{ comments, registerComment }}>
      {children}
    </InlineCommentContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useInlineComments() {
  return useContext(InlineCommentContext);
}
