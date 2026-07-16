"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, MessageSquareText } from "lucide-react";

interface ReadingCompanionPresentationProps {
  chatStyle?: CSSProperties;
  integrated: boolean;
  isWide: boolean;
  launcherHost: HTMLElement | null;
  launcherSuppressed: boolean;
  open: boolean;
  openButtonRef: RefObject<HTMLButtonElement | null>;
  panelContent: ReactNode;
  panelHost: HTMLElement | null;
  resizing: boolean;
  setChatRef: (element: HTMLElement | null) => void;
  setOpen: (open: boolean) => void;
}

function CompanionLauncher({
  buttonRef,
  variant,
  onOpen,
  open,
  suppressed,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  variant: "integrated" | "dock" | "fab";
  onOpen: () => void;
  open: boolean;
  suppressed: boolean;
}) {
  if (open || suppressed) return null;

  if (variant === "fab")
    return (
      <button
        ref={buttonRef}
        type="button"
        className="chat-col-fab"
        onClick={onOpen}
        aria-label="Open reading companion"
        aria-haspopup="dialog"
        data-companion-launcher
      >
        <MessageSquareText className="h-5 w-5" aria-hidden />
      </button>
    );

  return (
    <button
      ref={buttonRef}
      type="button"
      className={variant === "integrated" ? "chat-col-dock is-integrated" : "chat-col-dock"}
      onClick={onOpen}
      aria-label="Open reading companion"
      aria-controls="reading-companion-panel"
      aria-expanded={open}
      data-companion-launcher
    >
      <span className="chat-col-dock-row">
        <span className="chat-col-dock-spark" aria-hidden>
          <MessageSquareText className="h-3.5 w-3.5" />
        </span>
        <span className="chat-col-dock-title">Reading companion</span>
        <span className="chat-col-dock-arrow" aria-hidden>
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </span>
      <span className="chat-col-dock-sub">Ask about this page or save a note.</span>
    </button>
  );
}

export default function ReadingCompanionPresentation({
  chatStyle,
  integrated,
  isWide,
  launcherHost,
  launcherSuppressed,
  open,
  openButtonRef,
  panelContent,
  panelHost,
  resizing,
  setChatRef,
  setOpen,
}: ReadingCompanionPresentationProps) {
  const launcherVariant = integrated ? "integrated" : isWide ? "dock" : "fab";
  const launcher = (
    <CompanionLauncher
      buttonRef={openButtonRef}
      variant={launcherVariant}
      onOpen={() => setOpen(true)}
      open={open}
      suppressed={launcherSuppressed}
    />
  );
  const launcherNode = integrated && launcherHost ? createPortal(launcher, launcherHost) : launcher;
  const integratedPanel =
    integrated && panelHost
      ? createPortal(
          <div
            id="reading-companion-panel"
            ref={setChatRef}
            className={["chat-col", "reader-context-companion", open && "is-open"]
              .filter(Boolean)
              .join(" ")}
            tabIndex={-1}
            aria-hidden={!open}
            inert={!open}
            data-reading-companion-surface
          >
            {panelContent}
          </div>,
          panelHost
        )
      : null;

  return (
    <>
      {integrated ? (
        integratedPanel
      ) : isWide ? (
        <aside
          id="reading-companion-panel"
          ref={setChatRef}
          className={["chat-col", open && "is-open", resizing && "is-resizing"]
            .filter(Boolean)
            .join(" ")}
          style={chatStyle}
          role="complementary"
          aria-label="Reading companion"
          aria-hidden={!open}
          inert={!open}
        >
          {panelContent}
        </aside>
      ) : (
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <DialogPrimitive.Overlay className="chat-col-scrim" />
          <DialogPrimitive.Content
            ref={setChatRef}
            className={["chat-col", "is-open", resizing && "is-resizing"].filter(Boolean).join(" ")}
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <DialogPrimitive.Title className="sr-only">Reading companion</DialogPrimitive.Title>
            {panelContent}
          </DialogPrimitive.Content>
        </DialogPrimitive.Root>
      )}
      {launcherNode}
    </>
  );
}
