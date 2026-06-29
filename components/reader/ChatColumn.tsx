"use client";

// Reader chat: article | TOC | chat. At >=1400px it is a collapsible third
// column; below that it is an on-demand overlay drawer so the reading measure
// is never crushed. Open-state follows the viewport mode (re-checked on resize)
// and only the wide-column preference is persisted.

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
      setOpen(mq.matches ? stored !== "0" : false);
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
      <aside className={`chat-col${open ? " is-open" : ""}`} aria-label="AI chat" aria-hidden={!open}>
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
