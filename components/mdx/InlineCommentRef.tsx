'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useInlineComments } from './InlineCommentProvider';

/* ------------------------------------------------------------------ */
/*  InlineCommentRef                                                   */
/*  Clickable annotation marker that shows a popover with the          */
/*  corresponding inline comment content.                              */
/* ------------------------------------------------------------------ */

export default function InlineCommentRef({
  'data-id': dataId,
  children,
}: {
  'data-id'?: string;
  children?: ReactNode;
}) {
  const { comments } = useInlineComments();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  /* ── Position the popover below the trigger ─────────────────────── */
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popupW = 300;
    const margin = 8;

    let top = rect.bottom + margin + window.scrollY;
    let left = rect.left + window.scrollX;

    /* Clamp horizontally */
    const maxLeft = window.innerWidth - popupW - margin;
    left = Math.max(margin, Math.min(left, maxLeft));

    /* Flip above if below viewport */
    const estH = 120;
    if (rect.bottom + estH + margin > window.innerHeight) {
      top = rect.top - estH - margin + window.scrollY;
    }

    setPosition({ top, left });
  }, []);

  /* ── Toggle on click ────────────────────────────────────────────── */
  const handleClick = useCallback(() => {
    if (open) {
      setOpen(false);
    } else {
      updatePosition();
      setOpen(true);
    }
  }, [open, updatePosition]);

  /* ── Dismiss: outside click ─────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;

    function onDocClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [open]);

  /* ── Dismiss: Escape key ────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const content = dataId ? comments.get(dataId) : null;

  return (
    <>
      <span
        ref={triggerRef}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        aria-expanded={open}
        style={{
          cursor: 'pointer',
          display: 'inline',
        }}
      >
        {/* Render wrapped text if any children (future-proofing) */}
        {children}

        {/* Annotation icon — superscript marker */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--accent-blue)',
            verticalAlign: 'super',
            marginLeft: 1,
            opacity: open ? 1 : 0.7,
            transition: 'opacity 150ms ease',
          }}
          aria-hidden="true"
        >
          💬
        </span>
      </span>

      {/* ── Popover ───────────────────────────────────────────────── */}
      {open && content && (
        <div
          ref={popoverRef}
          style={{
            position: 'absolute',
            zIndex: 500,
            top: position.top,
            left: position.left,
            width: 300,
            maxWidth: 340,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-lg)',
            fontSize: 14,
            lineHeight: 1.6,
            color: 'var(--text)',
            animation: 'inline-comment-enter 180ms ease forwards',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
              color: 'var(--accent-blue)',
              marginBottom: 6,
            }}
          >
            💬 Author&apos;s Note
          </div>
          <div>{content}</div>
        </div>
      )}

      {/* ── Keyframe animation (injected once) ────────────────────── */}
      <style>{`
        @keyframes inline-comment-enter {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}
