'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toBlob } from 'html-to-image';
import { siteConfig } from '@/lib/site';
import ShareImageCard from '@/components/ui/ShareImageCard';
import { useSelectionShare } from '@/components/ui/SelectionShareProvider';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SelectionShareButtonProps {
  title: string;
  author: string;
  tags: string[];
  slug: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SelectionShareButton({
  title,
  author,
  tags,
  slug,
}: SelectionShareButtonProps) {
  const { selectedText, selectionRect, isActive } = useSelectionShare();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  /* ── Copied state reset ────────────────────────────────────────── */
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  /* ── Error state reset ─────────────────────────────────────────── */
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(false), 2000);
    return () => clearTimeout(timer);
  }, [error]);

  /* ── Dismiss: capture-phase outside click ──────────────────────── */
  useEffect(() => {
    if (!isActive) return;

    function onDocClick(e: MouseEvent) {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        /* Clear the selection so the provider sets isActive=false */
        window.getSelection()?.removeAllRanges();
      }
    }

    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [isActive]);

  /* ── Dismiss: Escape key ───────────────────────────────────────── */
  useEffect(() => {
    if (!isActive) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        window.getSelection()?.removeAllRanges();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isActive]);

  /* ── Click handler (Safari-safe clipboard pattern) ─────────────── */
  const handleClick = useCallback(() => {
    const cardEl = cardRef.current;
    if (!cardEl) return;

    const blogUrl = `${siteConfig.url}/blog/${slug}`;
    const truncated = selectedText.slice(0, siteConfig.share.maxTextLength);

    /* Safari-safe: pass Promise<Blob> directly to ClipboardItem */
    const blobPromise = toBlob(cardEl, { pixelRatio: 2 }).then((b) => {
      if (!b) throw new Error('Failed to generate image');
      return b;
    });

    const htmlContent = `<p>\u201c${truncated}\u201d \u2014 <a href="${blogUrl}">${title}</a></p>`;
    const plainContent = `\u201c${truncated}\u201d\n${blogUrl}`;

    if (typeof ClipboardItem !== 'undefined') {
      const item = new ClipboardItem({
        'image/png': blobPromise,
        'text/html': new Blob([htmlContent], { type: 'text/html' }),
        'text/plain': new Blob([plainContent], { type: 'text/plain' }),
      });

      navigator.clipboard
        .write([item])
        .then(() => {
          setCopied(true);
          setError(false);
        })
        .catch(() => {
          setError(true);
        });
    } else {
      /* Fallback: text-only clipboard for environments without ClipboardItem */
      navigator.clipboard
        .writeText(`\u201c${truncated}\u201d\n${blogUrl}`)
        .then(() => {
          setCopied(true);
          setError(false);
        })
        .catch(() => {
          setError(true);
        });
    }
  }, [selectedText, slug, title]);

  /* ── Positioning ───────────────────────────────────────────────── */
  const visible = isActive && selectionRect !== null;

  let top = 0;
  let left = 0;

  if (selectionRect) {
    const buttonWidth = 88;
    const buttonHeight = 34;
    const margin = 8;

    /* Center above the selection end */
    left = selectionRect.x + selectionRect.width / 2 - buttonWidth / 2;
    top = selectionRect.y - selectionRect.height - buttonHeight - margin;

    /* Horizontal clamping */
    left = Math.max(margin, Math.min(left, window.innerWidth - buttonWidth - margin));

    /* Vertical flip: if too close to top, position below selection */
    if (top - window.scrollY < margin) {
      top = selectionRect.y + margin;
    }
  }

  /* ── Button label ──────────────────────────────────────────────── */
  let label: React.ReactNode;
  if (copied) {
    label = '✓ Copied!';
  } else if (error) {
    label = 'Error';
  } else {
    label = (
      <>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
        Share
      </>
    );
  }

  return (
    <>
      {visible && (
        <button
          ref={buttonRef}
          data-share-button
          onClick={handleClick}
          style={{
            position: 'absolute',
            top,
            left,
            zIndex: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 12px',
            fontSize: 13,
            fontWeight: 600,
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            color: '#ffffff',
            background: '#2563eb',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            whiteSpace: 'nowrap',
            animation: 'share-button-enter 0.15s ease-out',
          }}
        >
          {label}
        </button>
      )}

      {/* Offscreen card for image capture */}
      <ShareImageCard
        ref={cardRef}
        title={title}
        selectedText={selectedText}
        author={author}
        tags={tags}
        blogUrl={`${siteConfig.url}/blog/${slug}`}
      />

      <style>{`
        @keyframes share-button-enter {
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
