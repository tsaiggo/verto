"use client";

// Reader chat companion. A floating slide-over drawer at every width: in the
// fixed 100dvh frame it pins to the reading region and overlays the TOC plus the
// right gutter (it never reflows the article), matching the prototype agent
// panel. Wide screens default closed so the reading room stays calm; the open
// state is persisted so a reader who opened it gets it back. Opens on the Ask
// event too (top bar Ask button). On wide screens a left-edge handle resizes the
// panel (drag or arrow keys) and the chosen width persists across reloads.

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Sparkles } from "lucide-react";
import AssistantPanel from "@/components/assistant/AssistantPanel";
import { getAssistantConfig } from "@/lib/ai";
import { ASK_AI_EVENT } from "@/lib/ai/ask-event";
import {
  CHAT_WIDTH_DEFAULT,
  CHAT_WIDTH_MAX,
  CHAT_WIDTH_MIN,
  clampChatWidth,
  loadChatWidth,
  saveChatWidth,
} from "@/lib/ui/panel-width";
import type { SummaryDocRef } from "@/lib/summaries";

const OPEN_KEY = "verto:chat-open";
const WIDE = "(min-width: 1400px)";
/** Arrow-key resize step for the drag handle. */
const RESIZE_STEP = 24;

type ChatColumnStyle = CSSProperties & { "--chat-col-w"?: string };

function updateCompanionLayoutVars(width: number, open: boolean, isWide: boolean): void {
  const layout = document.querySelector<HTMLElement>(".docs-layout");
  if (!layout) return;

  if (!open || !isWide) {
    layout.style.removeProperty("--chat-col-w");
    layout.style.removeProperty("--reader-toc-gap-w");
    return;
  }

  const article = layout.querySelector<HTMLElement>(".main > .content-wrap");
  const articleRight = article?.getBoundingClientRect().right ?? 0;
  const gap = Math.max(0, window.innerWidth - width - articleRight);
  // Below this there is not enough room for a readable TOC plus a 24px gutter,
  // so collapse it rather than letting it become a cramped sliver or overlap
  // the article.
  const visibleGap = gap >= 204 ? gap : 0;
  layout.style.setProperty("--chat-col-w", `${Math.round(width)}px`);
  layout.style.setProperty("--reader-toc-gap-w", `${Math.round(visibleGap)}px`);
}

export default function ChatColumn({ doc }: { doc?: SummaryDocRef }) {
  const [open, setOpen] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [width, setWidth] = useState(CHAT_WIDTH_DEFAULT);
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef(width);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    const mq = window.matchMedia(WIDE);
    const sync = () => {
      setIsWide(mq.matches);
      const stored = localStorage.getItem(OPEN_KEY);
      setOpen(mq.matches ? stored === "1" : false);
      setWidth(loadChatWidth(window.innerWidth));
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

  // Keep the panel on-screen if the window narrows below the chosen width.
  useEffect(() => {
    const onResize = () => setWidth((w) => clampChatWidth(w, window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // When the companion is open, keep the TOC in the visible gap between the
  // unchanged article measure and the companion instead of letting the fixed
  // companion cover the far-right TOC rail.
  useEffect(() => {
    updateCompanionLayoutVars(width, open, isWide);
    return () => updateCompanionLayoutVars(width, false, isWide);
  }, [width, open, isWide]);

  // Suppress text selection + show the resize cursor globally while dragging.
  useEffect(() => {
    document.body.classList.toggle("chat-resizing", resizing);
    return () => document.body.classList.remove("chat-resizing");
  }, [resizing]);

  const setOpenPersist = useCallback((next: boolean) => {
    setOpen(next);
    try {
      if (window.matchMedia(WIDE).matches) localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      /* storage may be unavailable; open state is a convenience */
    }
  }, []);

  const onHandlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizing(true);
  }, []);

  const onHandlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    // Right-anchored panel: width is the gap from the pointer to the right edge.
    setWidth(clampChatWidth(window.innerWidth - e.clientX, window.innerWidth));
  }, []);

  const endResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setResizing(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    saveChatWidth(widthRef.current);
  }, []);

  const onHandleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === "ArrowLeft")
      next = widthRef.current + RESIZE_STEP; // grow leftward
    else if (e.key === "ArrowRight") next = widthRef.current - RESIZE_STEP;
    else if (e.key === "Home") next = CHAT_WIDTH_MAX;
    else if (e.key === "End") next = CHAT_WIDTH_MIN;
    if (next == null) return;
    e.preventDefault();
    const clamped = clampChatWidth(next, window.innerWidth);
    setWidth(clamped);
    saveChatWidth(clamped);
  }, []);

  if (!getAssistantConfig().enabled) return null;

  const chatStyle: ChatColumnStyle | undefined = isWide
    ? { width: `${width}px`, "--chat-col-w": `${width}px` }
    : undefined;

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
        className={`chat-col${open ? " is-open" : ""}${resizing ? " is-resizing" : ""}`}
        style={chatStyle}
        aria-label="AI chat"
        aria-hidden={!open}
      >
        <div
          className="chat-col-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize reading companion"
          aria-valuenow={width}
          aria-valuemin={CHAT_WIDTH_MIN}
          aria-valuemax={CHAT_WIDTH_MAX}
          tabIndex={0}
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={endResize}
          onPointerCancel={endResize}
          onKeyDown={onHandleKeyDown}
        />
        <AssistantPanel doc={doc} onCollapse={() => setOpenPersist(false)} />
      </aside>
      {!open && isWide && (
        <button
          type="button"
          className="chat-col-dock"
          onClick={() => setOpenPersist(true)}
          aria-label="Open reading companion"
        >
          <span className="chat-col-dock-row">
            <span className="chat-col-dock-spark" aria-hidden>
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="chat-col-dock-title">Reading companion</span>
            <span className="chat-col-dock-arrow" aria-hidden>
              →
            </span>
          </span>
          <span className="chat-col-dock-sub">Ask about this page or save a note.</span>
        </button>
      )}
      {!open && !isWide && (
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
