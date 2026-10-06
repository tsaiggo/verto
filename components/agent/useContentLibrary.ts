"use client";

import { useEffect, useState } from "react";
import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import { subscribeBrowserArticles } from "@/lib/browser-articles";
import type { ContentService } from "@/lib/agent-content/service";
import type { AgentSource, WorkspaceStatus } from "./agent-types";

interface ContentLibrary {
  service?: ContentService;
  sources: AgentSource[];
  total: number;
  status: WorkspaceStatus;
  detail: string | null;
}

interface LibraryBinding extends ContentLibrary {
  input?: { sources: AgentSource[]; currentHref?: string; generation: number };
}

/** Expose metadata at startup; the model receives document passages on demand. */
export function useContentLibrary(
  sources: AgentSource[],
  enabled: boolean,
  currentHref?: string
): ContentLibrary {
  const [library, setLibrary] = useState<LibraryBinding>({
    sources: [],
    total: 0,
    status: "loading",
    detail: null,
  });
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const refresh = () => setGeneration((value) => value + 1);
    window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, refresh);
    const unsubscribe = subscribeBrowserArticles(refresh);
    return () => {
      window.removeEventListener(LOCAL_FOLDER_CHANGED_EVENT, refresh);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const input = { sources, currentHref, generation };
    setLibrary({ sources: [], total: 0, status: "loading", detail: null, input });
    void (async () => {
      const [{ createBrowserRepository }, { createContentService }] = await Promise.all([
        import("@/lib/agent-content/browser"),
        import("@/lib/agent-content/service"),
      ]);
      const service = createContentService(createBrowserRepository(sources, { currentHref }));
      const catalog = await service.listDocuments({ limit: 40 });
      if (cancelled) return;
      setLibrary({
        input,
        service,
        sources: catalog.documents.map((document) => ({
          title: document.title,
          subtitle: document.sourceLabel,
          href: document.href,
          body: "",
          tags: document.tags,
        })),
        total: catalog.total,
        status: "ready",
        detail:
          "Saved documents are searched and read on demand. Drafts and unsaved edits are excluded.",
      });
    })().catch(() => {
      if (!cancelled)
        setLibrary({
          input,
          sources: [],
          total: 0,
          status: "error",
          detail:
            "Couldn’t load the scoped Library. Reconnect the content source or reopen this page.",
        });
    });
    return () => {
      cancelled = true;
    };
  }, [sources, enabled, currentHref, generation]);

  // A scope change must remove the previous service before effects run.
  if (
    !enabled ||
    library.input?.sources !== sources ||
    library.input.currentHref !== currentHref ||
    library.input.generation !== generation
  ) {
    return { sources: [], total: 0, status: "loading", detail: null };
  }
  return library;
}
