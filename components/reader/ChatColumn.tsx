"use client";

// Reader chat companion. When an article TOC is present, desktop screens reuse
// that stable context card and switch it in place; narrower screens keep the
// same panel as a slide-over. Desktop screens persist the open state so a
// reader who opened it gets it back. Opens on the Ask event too (top bar Ask
// button). The no-TOC wide fallback keeps its resizable edge and saved width.

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";
import { usePathname } from "next/navigation";
import AssistantPanel from "@/components/assistant/AssistantPanel";
import ReadingCompanionPresentation from "@/components/reader/ReadingCompanionPresentation";
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
import {
  onExclusiveOverlayChange,
  releaseExclusiveOverlay,
  requestExclusiveOverlay,
} from "@/lib/ui/exclusive-overlay";

const OPEN_KEY = "verto:chat-open";
const CONTEXT_RAIL = "(min-width: 1280px)";
const WIDE = "(min-width: 1400px)";
/** Arrow-key resize step for the drag handle. */
const RESIZE_STEP = 24;

type ChatColumnStyle = CSSProperties & { "--chat-col-w"?: string };

function updateCompanionLayoutVars(width: number, open: boolean, isWide: boolean): void {
  const layout = document.querySelector<HTMLElement>(".docs-layout");
  if (!layout) return;

  if (!open || !isWide) {
    layout.style.removeProperty("--chat-col-w");
    return;
  }

  layout.style.setProperty("--chat-col-w", `${Math.round(width)}px`);
}

function companionStyle(isWide: boolean, width: number): ChatColumnStyle | undefined {
  const pixels = String(width) + "px";
  return isWide ? { width: pixels, "--chat-col-w": pixels } : undefined;
}

function useCompanionFocus(open: boolean, presentation: "integrated" | "wide" | "dialog") {
  const chatRef = useRef<HTMLElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const panelWasOpenRef = useRef(false);
  const focusOnOpenRef = useRef(false);

  const rememberTrigger = useCallback(() => {
    const activeElement = document.activeElement;
    restoreFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    focusOnOpenRef.current = true;
  }, []);

  const setChatRef = useCallback((element: HTMLElement | null) => {
    chatRef.current = element;
  }, []);

  useEffect(() => {
    if (open) {
      panelWasOpenRef.current = true;
      if (!focusOnOpenRef.current) return;
      const frame = window.requestAnimationFrame(() => {
        focusOnOpenRef.current = false;
        const closeButton =
          chatRef.current?.querySelector<HTMLElement>("[data-companion-close]") ?? null;
        (closeButton ?? chatRef.current)?.focus({ preventScroll: true });
      });
      return () => window.cancelAnimationFrame(frame);
    }

    if (panelWasOpenRef.current) {
      panelWasOpenRef.current = false;
      focusOnOpenRef.current = false;
      const restoreTarget = restoreFocusRef.current;
      restoreFocusRef.current = null;
      window.requestAnimationFrame(() => {
        const targetIsUsable =
          restoreTarget?.isConnected &&
          restoreTarget.getClientRects().length > 0 &&
          !restoreTarget.closest('[inert], dialog:not([open]), [aria-hidden="true"]');
        const target = targetIsUsable ? restoreTarget : openButtonRef.current;
        target?.focus({ preventScroll: true });
      });
    }
  }, [open, presentation]);

  return { openButtonRef, rememberTrigger, setChatRef };
}

function CompanionPanelContent({
  doc,
  width,
  integrated,
  onCollapse,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  onKeyDown,
}: {
  doc?: SummaryDocRef;
  width: number;
  integrated: boolean;
  onCollapse: () => void;
  onPointerDown: React.PointerEventHandler<HTMLDivElement>;
  onPointerMove: React.PointerEventHandler<HTMLDivElement>;
  onPointerEnd: React.PointerEventHandler<HTMLDivElement>;
  onKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
}) {
  return (
    <>
      {!integrated && (
        <div
          className="chat-col-resize"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize reading companion"
          aria-valuenow={width}
          aria-valuemin={CHAT_WIDTH_MIN}
          aria-valuemax={CHAT_WIDTH_MAX}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onKeyDown={onKeyDown}
        />
      )}
      <AssistantPanel
        doc={doc}
        onCollapse={onCollapse}
        collapseMode={integrated ? "contents" : "close"}
      />
    </>
  );
}

function useCompanionResize(width: number, setWidth: Dispatch<SetStateAction<number>>) {
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef(width);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  useEffect(() => {
    document.body.classList.toggle("chat-resizing", resizing);
    return () => document.body.classList.remove("chat-resizing");
  }, [resizing]);

  const onHandlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizing(true);
  }, []);

  const onHandlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      setWidth(clampChatWidth(window.innerWidth - event.clientX, window.innerWidth));
    },
    [setWidth]
  );

  const endResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    setResizing(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer already released */
    }
    saveChatWidth(widthRef.current);
  }, []);

  const onHandleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      let next: number | null = null;
      if (event.key === "ArrowLeft") next = widthRef.current + RESIZE_STEP;
      else if (event.key === "ArrowRight") next = widthRef.current - RESIZE_STEP;
      else if (event.key === "Home") next = CHAT_WIDTH_MAX;
      else if (event.key === "End") next = CHAT_WIDTH_MIN;
      if (next == null) return;
      event.preventDefault();
      const clamped = clampChatWidth(next, window.innerWidth);
      setWidth(clamped);
      saveChatWidth(clamped);
    },
    [setWidth]
  );

  return {
    resizing,
    onHandlePointerDown,
    onHandlePointerMove,
    endResize,
    onHandleKeyDown,
  };
}

function useCompanionOverlayCoordination(
  open: boolean,
  modal: boolean,
  setCompanionOpen: (open: boolean) => void
) {
  const [suppressed, setSuppressed] = useState(false);

  useEffect(
    () =>
      onExclusiveOverlayChange((overlay, overlayOpen) => {
        if (overlay === "reading-companion" && overlayOpen) {
          setSuppressed(false);
          return;
        }
        if (overlay === "mobile-navigation") {
          setSuppressed(overlayOpen);
          if (overlayOpen) setCompanionOpen(false);
        }
      }),
    [setCompanionOpen]
  );

  useEffect(() => {
    if (!open || !modal) return;
    return () => releaseExclusiveOverlay("reading-companion");
  }, [modal, open]);

  return suppressed;
}

export default function ChatColumn({ doc }: { doc?: SummaryDocRef }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isContextRail, setIsContextRail] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [width, setWidth] = useState(CHAT_WIDTH_DEFAULT);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [launcherHost, setLauncherHost] = useState<HTMLElement | null>(null);
  const [panelHost, setPanelHost] = useState<HTMLElement | null>(null);
  const { resizing, onHandlePointerDown, onHandlePointerMove, endResize, onHandleKeyDown } =
    useCompanionResize(width, setWidth);
  const desktopWasReadyRef = useRef(false);
  const integrated = isContextRail && launcherHost !== null && panelHost !== null;
  const presentation = integrated ? "integrated" : isWide ? "wide" : "dialog";
  const modal = presentation === "dialog";
  const desktopPanel = integrated || isWide;
  const { openButtonRef, rememberTrigger, setChatRef } = useCompanionFocus(open, presentation);

  const setOpenPersist = useCallback(
    (next: boolean) => {
      if (next) {
        if (!open) {
          rememberTrigger();
          if (modal) requestExclusiveOverlay("reading-companion");
        }
      } else {
        releaseExclusiveOverlay("reading-companion");
      }
      setOpen(next);
      try {
        if (desktopPanel) localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      } catch {
        /* storage may be unavailable; open state is a convenience */
      }
    },
    [desktopPanel, modal, open, rememberTrigger]
  );
  const launcherSuppressed = useCompanionOverlayCoordination(open, modal, setOpenPersist);

  useEffect(() => {
    const contextMq = window.matchMedia(CONTEXT_RAIL);
    const wideMq = window.matchMedia(WIDE);
    const sync = () => {
      setIsContextRail(contextMq.matches);
      setIsWide(wideMq.matches);
      setWidth(loadChatWidth(window.innerWidth));
    };
    sync();
    contextMq.addEventListener("change", sync);
    wideMq.addEventListener("change", sync);
    return () => {
      contextMq.removeEventListener("change", sync);
      wideMq.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const syncHosts = () => {
      setLauncherHost(
        document.querySelector<HTMLElement>("[data-reading-companion-launcher-host]")
      );
      setPanelHost(document.querySelector<HTMLElement>("[data-reading-companion-panel-host]"));
    };
    const scheduleSync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(syncHosts);
    };
    const layout = document.querySelector(".docs-layout") ?? document.body;
    const observer = new MutationObserver(scheduleSync);
    observer.observe(layout, { childList: true, subtree: true });
    scheduleSync();

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!desktopPanel) {
        if (desktopWasReadyRef.current) setOpen(false);
        desktopWasReadyRef.current = false;
        return;
      }
      if (desktopWasReadyRef.current) return;
      desktopWasReadyRef.current = true;
      try {
        setOpen(localStorage.getItem(OPEN_KEY) === "1");
      } catch {
        setOpen(false);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [desktopPanel]);

  useEffect(() => {
    const onAsk = () => {
      setOpenPersist(true);
    };
    window.addEventListener(ASK_AI_EVENT, onAsk);
    return () => window.removeEventListener(ASK_AI_EVENT, onAsk);
  }, [setOpenPersist]);

  useEffect(() => {
    if (!open || modal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      setOpenPersist(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal, open, setOpenPersist]);

  // Keep the panel on-screen if the window narrows below the chosen width.
  useEffect(() => {
    const onResize = () => {
      setWidth((w) => clampChatWidth(w, window.innerWidth));
      setLayoutRevision((revision) => revision + 1);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  // Only the no-TOC fallback needs to reserve page width. The integrated
  // reader-tools panel already owns a stable column in the workbench grid.
  useEffect(() => {
    updateCompanionLayoutVars(width, open && !integrated, isWide && !integrated);
    return () => updateCompanionLayoutVars(width, false, isWide && !integrated);
  }, [width, open, isWide, integrated, layoutRevision]);

  if (!getAssistantConfig().enabled) return null;

  const chatStyle = companionStyle(isWide, width);

  const panelContent = (
    <CompanionPanelContent
      doc={doc}
      width={width}
      integrated={integrated}
      onCollapse={() => setOpenPersist(false)}
      onPointerDown={onHandlePointerDown}
      onPointerMove={onHandlePointerMove}
      onPointerEnd={endResize}
      onKeyDown={onHandleKeyDown}
    />
  );

  return (
    <ReadingCompanionPresentation
      chatStyle={chatStyle}
      integrated={integrated}
      isWide={isWide}
      launcherHost={launcherHost}
      launcherSuppressed={launcherSuppressed}
      open={open}
      openButtonRef={openButtonRef}
      panelContent={panelContent}
      panelHost={panelHost}
      resizing={resizing}
      setChatRef={setChatRef}
      setOpen={setOpenPersist}
    />
  );
}
