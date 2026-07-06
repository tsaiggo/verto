"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  CompareCaption,
  CompareHandle,
  CompareLabels,
  nextPosForKey,
} from "./compare-slider-parts";

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
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [updateFromClientX]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    updateFromClientX(e.clientX);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const next = nextPosForKey(e.key, pos);
    if (next !== null) {
      e.preventDefault();
      setPos(clamp(next));
    }
  };

  const onHandlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    // Avoid double-trigger from the outer frame.
    e.stopPropagation();
    draggingRef.current = true;
    updateFromClientX(e.clientX);
  };

  const containerStyle: React.CSSProperties = aspect ? { aspectRatio: String(aspect) } : {};

  return (
    <figure className="compare compare-slider" ref={containerRef}>
      <div className="compare-slider-frame" style={containerStyle} onPointerDown={onPointerDown}>
        {/* "After" image is the base layer (fully visible). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="compare-slider-img compare-slider-after"
          src={after}
          alt={alt ? `After: ${alt}` : "After"}
          draggable={false}
        />
        {/* "Before" image is clipped from the right. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="compare-slider-img compare-slider-before"
          src={before}
          alt={alt ? `Before: ${alt}` : "Before"}
          draggable={false}
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) {
              setAspect(img.naturalWidth / img.naturalHeight);
            }
          }}
        />

        <CompareLabels beforeLabel={beforeLabel} afterLabel={afterLabel} pos={pos} />

        <CompareHandle
          pos={pos}
          labelId={labelId}
          hasLabel={Boolean(beforeLabel || afterLabel)}
          onKeyDown={onKeyDown}
          onPointerDown={onHandlePointerDown}
        />
      </div>
      <CompareCaption labelId={labelId} beforeLabel={beforeLabel} afterLabel={afterLabel} />
    </figure>
  );
}
