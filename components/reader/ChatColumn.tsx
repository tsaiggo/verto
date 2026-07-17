"use client";

// Reader chat companion. On wide screens it docks beside the reading surface;
// narrower screens keep the same panel as a slide-over. Wide screens default
// closed so the reading room stays calm; the open state is persisted so a
// reader who opened it gets it back. Opens on the Ask event too (top bar Ask
// button). On wide screens a left-edge handle resizes the panel (drag or arrow
// keys) and the chosen width persists across reloads.

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
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type ChatColumnStyle = CSSProperties & { "--chat-col-w"?: string };

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true"
  );
}

function updateCompanionLayoutVars(width: number, open: boolean, isWide: boolean): void {
  const layout = document.querySelector<HTMLElement>(".docs-layout");
  if (!layout) return;

  if (!open || !isWide) {
    layout.style.removeProperty("--chat-col-w");
    return;
  }

  layout.style.setProperty("--chat-col-w", `${Math.round(width)}px`);
}

function useCompanionModalFocus(open: boolean, isWide: boolean, setOpen: (next: boolean) => void) {
  const chatRef = useRef<HTMLElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const modalWasOpenRef = useRef(false);

  const rememberModalTrigger = useCallback(() => {
    if (window.matchMedia(WIDE).matches) return;
    const activeElement = document.activeElement;
    restoreFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
  }, []);

  useEffect(() => {
    const modalOpen = open && !isWide;
    if (modalOpen) {
      modalWasOpenRef.current = true;
      const frame = window.requestAnimationFrame(() => {
        chatRef.current?.focus({ preventScroll: true });
      });
      return () => window.cancelAnimationFrame(frame);
    }

    if (modalWasOpenRef.current) {
      modalWasOpenRef.current = false;
      const restoreTarget = restoreFocusRef.current;
      restoreFocusRef.current = null;
      window.requestAnimationFrame(() => {
        const target = restoreTarget?.isConnected ? restoreTarget : openButtonRef.current;
        target?.focus({ preventScroll: true });
      });
    }
  }, [isWide, open]);

  const onChatKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (!open || isWide) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }

      if (event.key !== "Tab") return;
      const panel = event.currentTarget;
      const focusableElements = getFocusableElements(panel);
      if (focusableElements.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      const focusOutsidePanel = !(activeElement instanceof Node) || !panel.contains(activeElement);

      if (
        event.shiftKey &&
        (activeElement === first || activeElement === panel || focusOutsidePanel)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === last || activeElement === panel || focusOutsidePanel)
      ) {
        event.preventDefault();
        first.focus();
      }
    },
    [isWide, open, setOpen]
  );

  return { chatRef, openButtonRef, rememberModalTrigger, onChatKeyDown };
}

function CompanionLauncher({
  buttonRef,
  isWide,
  onOpen,
  open,
}: {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  isWide: boolean;
  onOpen: () => void;
  open: boolean;
}) {
  if (open) return null;

  if (isWide) {
    return (
      <button
        ref={buttonRef}
        type="button"
        className="chat-col-dock"
        onClick={onOpen}
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
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className="chat-col-fab"
      onClick={onOpen}
      aria-label="Open reading companion"
    >
      <Sparkles className="h-5 w-5" aria-hidden />
    </button>
  );
}

export default function ChatColumn({ doc }: { doc?: SummaryDocRef }) {
  const [open, setOpen] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [width, setWidth] = useState(CHAT_WIDTH_DEFAULT);
  const [resizing, setResizing] = useState(false);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const widthRef = useRef(width);
  const { chatRef, openButtonRef, rememberModalTrigger, onChatKeyDown } = useCompanionModalFocus(
    open,
    isWide,
    setOpen
  );

  const setOpenPersist = useCallback(
    (next: boolean) => {
      if (next) rememberModalTrigger();
      setOpen(next);
      try {
        if (window.matchMedia(WIDE).matches) localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      } catch {
        /* storage may be unavailable; open state is a convenience */
      }
    },
    [rememberModalTrigger]
  );

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
    const onAsk = () => {
      rememberModalTrigger();
      setOpen(true);
    };
    window.addEventListener(ASK_AI_EVENT, onAsk);
    return () => window.removeEventListener(ASK_AI_EVENT, onAsk);
  }, [rememberModalTrigger]);

  // Keep the panel on-screen if the window narrows below the chosen width.
  useEffect(() => {
    const onResize = () => {
      setWidth((w) => clampChatWidth(w, window.innerWidth));
      setLayoutRevision((revision) => revision + 1);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  // Expose the live panel width to the reader shell so wide screens can reserve
  // real space for the companion instead of covering article text.
  useEffect(() => {
    updateCompanionLayoutVars(width, open, isWide);
    return () => updateCompanionLayoutVars(width, false, isWide);
  }, [width, open, isWide, layoutRevision]);

  // Suppress text selection + show the resize cursor globally while dragging.
  useEffect(() => {
    document.body.classList.toggle("chat-resizing", resizing);
    return () => document.body.classList.remove("chat-resizing");
  }, [resizing]);

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
        ref={chatRef}
        className={`chat-col${open ? " is-open" : ""}${resizing ? " is-resizing" : ""}`}
        style={chatStyle}
        role={open && !isWide ? "dialog" : undefined}
        aria-label="AI chat"
        aria-modal={open && !isWide ? true : undefined}
        aria-hidden={!open}
        inert={!open}
        tabIndex={open && !isWide ? -1 : undefined}
        onKeyDown={onChatKeyDown}
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
      <CompanionLauncher
        buttonRef={openButtonRef}
        isWide={isWide}
        onOpen={() => setOpenPersist(true)}
        open={open}
      />
    </>
  );
}
