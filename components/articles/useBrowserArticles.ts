"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listBrowserArticles,
  subscribeBrowserArticles,
  type BrowserArticle,
} from "@/lib/browser-articles";

export interface BrowserArticlesState {
  articles: BrowserArticle[];
  status: "loading" | "ready" | "error";
  error: string | null;
  retry: () => void;
}

export function useBrowserArticles({
  enabled = true,
}: { enabled?: boolean } = {}): BrowserArticlesState {
  const [retryRevision, setRetryRevision] = useState(0);
  const [state, setState] = useState<Omit<BrowserArticlesState, "retry">>({
    articles: [],
    status: "loading",
    error: null,
  });
  const retry = useCallback(() => setRetryRevision((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let requestRevision = 0;
    const refresh = () => {
      if (!active) return;
      const request = ++requestRevision;
      setState((previous) => ({ ...previous, status: "loading", error: null }));
      listBrowserArticles().then(
        (articles) => {
          if (active && request === requestRevision)
            setState({ articles, status: "ready", error: null });
        },
        (error: unknown) => {
          if (active && request === requestRevision) {
            setState((previous) => ({
              ...previous,
              status: "error",
              error: error instanceof Error ? error.message : String(error),
            }));
          }
        }
      );
    };
    const unsubscribe = subscribeBrowserArticles(refresh);
    queueMicrotask(refresh);
    return () => {
      active = false;
      requestRevision++;
      unsubscribe();
    };
  }, [enabled, retryRevision]);

  return enabled ? { ...state, retry } : { articles: [], status: "ready", error: null, retry };
}
