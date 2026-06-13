"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_ROOT_MARGIN = "640px 0px";
const DEFAULT_FALLBACK_MS = 4000;

export function useNearViewport<T extends Element>(
  rootMargin = DEFAULT_ROOT_MARGIN,
  fallbackMs = DEFAULT_FALLBACK_MS
) {
  const ref = useRef<T>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    if (isNearViewport) return;

    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      const timeout = window.setTimeout(() => setIsNearViewport(true), 0);
      return () => window.clearTimeout(timeout);
    }

    const fallback = window.setTimeout(() => {
      setIsNearViewport(true);
    }, fallbackMs);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) {
          window.clearTimeout(fallback);
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(node);

    return () => {
      window.clearTimeout(fallback);
      observer.disconnect();
    };
  }, [fallbackMs, isNearViewport, rootMargin]);

  return [ref, isNearViewport] as const;
}
