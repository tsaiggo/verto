'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';

interface CompareSliderProps {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  /** Initial position of the divider as a percentage (0–100). Default 50. */
  initial?: number;
  /** Optional alt text. Used for both layers, prefixed with "Before" / "After". */
  alt?: string;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * <CompareSlider> — client-only image before/after slider.
 *
 * Stacks two images and reveals the "before" image via a `clip-path: inset()`
 * driven by the divider position. Supports mouse, touch, and keyboard
 * (←/→ ±5%, Home/End jump to 0/100). Implements the WAI-ARIA slider role.
 *
 * The container's aspect ratio is taken from the natural dimensions of the
 * `before` image (read once it loads) so the layout doesn't jump.
 */
export default function CompareSlider({
  before,
  after,
  beforeLabel,
  afterLabel,
  initial = 50,
  alt,
}: CompareSliderProps) {
  const [pos, setPos] = useState<number>(clamp(initial));
  const [aspect, setAspect] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<boolean>(false);
  const labelId = useId();

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPos(clamp(next));
  }, []);

  // Pointer events handle mouse, pen, and touch uniformly.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      updateFromClientX(e.clientX);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [updateFromClientX]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    updateFromClientX(e.clientX);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowLeft':
        next = pos - 5;
        break;
      case 'ArrowRight':
        next = pos + 5;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = 100;
        break;
    }
    if (next !== null) {
      e.preventDefault();
      setPos(clamp(next));
    }
  };

  const containerStyle: React.CSSProperties = aspect
    ? { aspectRatio: String(aspect) }
    : {};

  return (
    <figure className="compare compare-slider" ref={containerRef}>
      <div
        className="compare-slider-frame"
        style={containerStyle}
        onPointerDown={onPointerDown}
      >
        {/* "After" image is the base layer (fully visible). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="compare-slider-img compare-slider-after"
          src={after}
          alt={alt ? `After: ${alt}` : 'After'}
          draggable={false}
        />
        {/* "Before" image is clipped from the right. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="compare-slider-img compare-slider-before"
          src={before}
          alt={alt ? `Before: ${alt}` : 'Before'}
          draggable={false}
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) {
              setAspect(img.naturalWidth / img.naturalHeight);
            }
          }}
        />

        {beforeLabel && (
          <span
            className="compare-slider-label compare-slider-label-before"
            style={{ opacity: pos > 8 ? 1 : 0 }}
          >
            {beforeLabel}
          </span>
        )}
        {afterLabel && (
          <span
            className="compare-slider-label compare-slider-label-after"
            style={{ opacity: pos < 92 ? 1 : 0 }}
          >
            {afterLabel}
          </span>
        )}

        <div
          className="compare-slider-divider"
          style={{ left: `${pos}%` }}
          aria-hidden="true"
        >
          <button
            type="button"
            className="compare-slider-handle"
            role="slider"
            aria-label="Drag to compare before and after"
            aria-labelledby={beforeLabel || afterLabel ? labelId : undefined}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            aria-valuetext={`${Math.round(pos)}% before`}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onPointerDown={(e) => {
              // Avoid double-trigger from the outer frame.
              e.stopPropagation();
              draggingRef.current = true;
              updateFromClientX(e.clientX);
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 6 9 12 15 18" />
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </button>
        </div>
      </div>
      {(beforeLabel || afterLabel) && (
        <figcaption id={labelId} className="compare-caption">
          {beforeLabel && <span>{beforeLabel}</span>}
          {beforeLabel && afterLabel && <span aria-hidden="true"> ↔ </span>}
          {afterLabel && <span>{afterLabel}</span>}
        </figcaption>
      )}
    </figure>
  );
}
