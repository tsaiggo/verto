"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_ROOT_MARGIN = "640px 0px";

// Heavy renderers should stay idle until a reader approaches them. A timer
// fallback turns below-the-fold diagrams into background CPU work.
export function useNearViewport<T extends Element>(rootMargin = DEFAULT_ROOT_MARGIN) {
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

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting || entry.intersectionRatio > 0)) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [isNearViewport, rootMargin]);

  return [ref, isNearViewport] as const;
}
