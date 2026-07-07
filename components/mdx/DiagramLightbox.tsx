"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Maximize2, X } from "lucide-react";

interface DiagramLightboxProps {
  readonly title: string;
  readonly disabled?: boolean;
  readonly children: ReactNode;
  readonly expanded: ReactNode;
}

export function DiagramLightbox({ title, disabled, children, expanded }: DiagramLightboxProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const canOpen = !disabled;

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("diagram-lightbox-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("diagram-lightbox-open");
    };
  }, [open]);

  const openLightbox = () => {
    if (canOpen) setOpen(true);
  };

  return (
    <>
      <div
        className={`diagram-frame${canOpen ? " is-interactive" : ""}`}
        role={canOpen ? "button" : undefined}
        tabIndex={canOpen ? 0 : undefined}
        aria-label={canOpen ? `Open larger ${title}` : undefined}
        onClick={openLightbox}
        onKeyDown={(event) => {
          if (!canOpen) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {children}
        {canOpen && (
          <span className="diagram-frame-hint" aria-hidden>
            <Maximize2 className="diagram-frame-hint-icon" />
            Open larger
          </span>
        )}
      </div>

      {open && (
        <div
          className="diagram-lightbox"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="diagram-lightbox-panel">
            <div className="diagram-lightbox-head">
              <h2 id={titleId}>{title}</h2>
              <button
                type="button"
                className="diagram-lightbox-close"
                onClick={() => setOpen(false)}
                aria-label="Close larger diagram view"
              >
                <X aria-hidden />
              </button>
            </div>
            <div className="diagram-lightbox-body">{expanded}</div>
          </div>
        </div>
      )}
    </>
  );
}
