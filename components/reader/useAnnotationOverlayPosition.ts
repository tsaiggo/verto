"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const MARGIN = 8;
const GAP = 8;

/** Page-space placement for a top-origin passage rect and a measured overlay. */
export function annotationOverlayPosition(
  anchor: AnchorRect,
  size: { width: number; height: number },
  viewport: ViewportRect
) {
  const maxWidth = Math.max(0, viewport.width - MARGIN * 2);
  const maxHeight = Math.max(0, viewport.height - MARGIN * 2);
  const width = Math.min(size.width, maxWidth);
  const height = Math.min(size.height, maxHeight);
  const minTop = viewport.top + MARGIN;
  const maxTop = viewport.top + viewport.height - height - MARGIN;
  const below = anchor.y + anchor.height + GAP;
  const above = anchor.y - height - GAP;
  const preferred = below + height <= viewport.top + viewport.height - MARGIN ? below : above;

  return {
    left: Math.max(
      viewport.left + MARGIN,
      Math.min(
        anchor.x + anchor.width / 2 - width / 2,
        viewport.left + viewport.width - width - MARGIN
      )
    ),
    top: Math.max(minTop, Math.min(preferred, maxTop)),
    maxWidth,
    maxHeight,
  };
}

export function useAnnotationOverlayPosition(
  ref: RefObject<HTMLDivElement | null>,
  { x, y, width, height }: AnchorRect
) {
  const [position, setPosition] = useState<ReturnType<typeof annotationOverlayPosition> | null>(
    null
  );

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const visualViewport = window.visualViewport;
    function updatePosition() {
      const next = annotationOverlayPosition(
        { x, y, width, height },
        { width: element!.offsetWidth, height: element!.offsetHeight },
        {
          left: visualViewport?.pageLeft ?? window.scrollX,
          top: visualViewport?.pageTop ?? window.scrollY,
          width: visualViewport?.width ?? window.innerWidth,
          height: visualViewport?.height ?? window.innerHeight,
        }
      );
      setPosition((current) =>
        current &&
        current.left === next.left &&
        current.top === next.top &&
        current.maxWidth === next.maxWidth &&
        current.maxHeight === next.maxHeight
          ? current
          : next
      );
    }
    updatePosition();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updatePosition);
    observer?.observe(element);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition);
    visualViewport?.addEventListener("resize", updatePosition);
    visualViewport?.addEventListener("scroll", updatePosition);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
      visualViewport?.removeEventListener("resize", updatePosition);
      visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [ref, x, y, width, height]);

  return {
    ...position,
    overflowY: "auto" as const,
    overscrollBehavior: "contain" as const,
  };
}
