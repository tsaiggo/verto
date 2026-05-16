'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { toast } from 'sonner';
import { siteConfig } from '@/lib/site';
import ShareImageCard from '@/components/ui/ShareImageCard';
import { useSelectionShare } from '@/components/ui/SelectionShareProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* Chrome 138+ protection: filter out CSS custom properties (Issue #542) */
const getStandardStyleProperties = () => {
  if (typeof window === 'undefined') return undefined;
  const style = getComputedStyle(document.documentElement);
  return Array.from({ length: style.length }, (_, i) => style[i]).filter(
    (name) => !name.startsWith('--'),
  );
};

interface SelectionShareButtonProps {
  title: string;
  author: string;
  tags: string[];
  slug: string;
}

export default function SelectionShareButton({
  title,
  author,
  tags,
  slug,
}: SelectionShareButtonProps) {
  const { selectedText, selectionRect, isActive } = useSelectionShare();
  const cardRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [capturing, setCapturing] = useState(false);

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
    if (capturing) return;

    setCapturing(true);

    const blogUrl = `${siteConfig.url}/blog/${slug}`;
    const truncated = selectedText.slice(0, siteConfig.share.maxTextLength);
    const includeStyleProperties = getStandardStyleProperties();

    const blobPromise = new Promise<Blob>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Card mount timeout')),
        3000,
      );

      const waitForCard = () => {
        requestAnimationFrame(() => {
          const el = cardRef.current;
          if (el && el.clientWidth > 0) {
            clearTimeout(timeout);
            document.fonts.ready
              .then(() =>
                toBlob(el, {
                  pixelRatio: 2,
                  backgroundColor: '#667eea',
                  width: el.scrollWidth,
                  height: el.scrollHeight,
                  ...(includeStyleProperties ? { includeStyleProperties } : {}),
                }),
              )
              .then((b) =>
                b ? resolve(b) : reject(new Error('Failed to generate image')),
              )
              .catch(reject);
          } else {
            waitForCard();
          }
        });
      };
      waitForCard();
    });

    const htmlContent = `<p>\u201c${truncated}\u201d \u2014 <a href="${blogUrl}">${title}</a></p>`;
    const plainContent = `\u201c${truncated}\u201d\n${blogUrl}`;

    const writePromise =
      typeof ClipboardItem !== 'undefined'
        ? navigator.clipboard.write([
            new ClipboardItem({
              'image/png': blobPromise,
              'text/html': new Blob([htmlContent], { type: 'text/html' }),
              'text/plain': new Blob([plainContent], { type: 'text/plain' }),
            }),
          ])
        : navigator.clipboard.writeText(plainContent);

    writePromise
      .then(() => {
        toast.success('Copied to clipboard', {
          description: 'Image and quote are ready to paste.',
        });
      })
      .catch(() => {
        toast.error("Couldn't copy to clipboard", {
          description: 'Please try again, or check browser permissions.',
        });
      })
      .finally(() => {
        setCapturing(false);
      });
  }, [capturing, selectedText, slug, title]);

  /* ── Positioning ───────────────────────────────────────────────── */
  const visible = isActive && selectionRect !== null;

  let top = 0;
  let left = 0;

  if (selectionRect) {
    const buttonWidth = 96;
    const buttonHeight = 34;
    const margin = 8;

    /* Center above the selection end */
    left = selectionRect.x + selectionRect.width / 2 - buttonWidth / 2;
    top =
      selectionRect.y - selectionRect.height - buttonHeight - margin;

    /* Horizontal clamping */
    left = Math.max(
      margin,
      Math.min(left, window.innerWidth - buttonWidth - margin),
    );

    /* Vertical flip: if too close to top, position below selection */
    if (top - window.scrollY < margin) {
      top = selectionRect.y + margin;
    }
  }

  return (
    <>
      {visible && (
        <Button
          ref={buttonRef}
          data-share-button
          onClick={handleClick}
          disabled={capturing}
          size="sm"
          className={cn(
            'absolute z-[500] h-[34px] gap-1.5 bg-accent-blue text-white shadow-md hover:bg-accent-blue/90',
            'animate-in fade-in-0 zoom-in-95 duration-150',
          )}
          style={{ top, left }}
        >
          <Share2 className="h-3.5 w-3.5" />
          Share
        </Button>
      )}

      {/* Hidden card for image capture */}
      {capturing && (
        <div style={{ height: 0, overflow: 'hidden' }}>
          <ShareImageCard
            ref={cardRef}
            title={title}
            selectedText={selectedText}
            author={author}
            tags={tags}
            blogUrl={`${siteConfig.url}/blog/${slug}`}
          />
        </div>
      )}
    </>
  );
}
