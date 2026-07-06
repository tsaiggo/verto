"use client";

// Reader chat companion. A floating slide-over drawer at every width: in the
// fixed 100dvh frame it pins to the reading region and overlays the TOC plus the
// right gutter (it never reflows the article), matching the prototype agent
// panel. Wide screens default closed so the reading room stays calm; the open
// state is persisted so a reader who opened it gets it back. Opens on the Ask
// event too (top bar Ask button).

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import AssistantPanel from "@/components/assistant/AssistantPanel";
import { getAssistantConfig } from "@/lib/ai";
import { ASK_AI_EVENT } from "@/lib/ai/ask-event";
import type { SummaryDocRef } from "@/lib/summaries";

const OPEN_KEY = "verto:chat-open";
const WIDE = "(min-width: 1400px)";

export default function ChatColumn({ doc }: { doc?: SummaryDocRef }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const sync = () => {
      const stored = localStorage.getItem(OPEN_KEY);
      setOpen(mq.matches ? stored === "1" : false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const onAsk = () => setOpen(true);
    window.addEventListener(ASK_AI_EVENT, onAsk);
    return () => window.removeEventListener(ASK_AI_EVENT, onAsk);
  }, []);

  const setOpenPersist = useCallback((next: boolean) => {
    setOpen(next);
    try {
      if (window.matchMedia(WIDE).matches) localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      /* storage may be unavailable; open state is a convenience */
    }
  }, []);

  if (!getAssistantConfig().enabled) return null;

  return (
    <>
      <button
        type="button"
        className="chat-col-scrim"
        aria-label="Close chat"
        tabIndex={-1}
        hidden={!open}
        onClick={() => setOpenPersist(false)}
      />
      <aside
        className={`chat-col${open ? " is-open" : ""}`}
        aria-label="AI chat"
        aria-hidden={!open}
      >
        <AssistantPanel doc={doc} onCollapse={() => setOpenPersist(false)} />
      </aside>
      {!open && (
        <button
          type="button"
          className="chat-col-fab"
          onClick={() => setOpenPersist(true)}
          aria-label="Open reading companion"
        >
          <Sparkles className="h-5 w-5" aria-hidden />
        </button>
      )}
    </>
  );
}
