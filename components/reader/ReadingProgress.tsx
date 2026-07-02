"use client";

import { useEffect, useState } from "react";
import { computeScrollProgress } from "@/lib/reading-state";
import {
  getReadingScrollElement,
  getReadingScrollEventTarget,
} from "@/lib/reading-scroll";

/**
 * Thin progress bar fixed under the navbar that fills as the reading region
 * scrolls. Mounts only on the client so it never participates in hydration.
 */
export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const scroller = getReadingScrollElement();
    const target = getReadingScrollEventTarget(scroller);
    function update() {
      setProgress(computeScrollProgress(scroller).progress);
    }
    update();
    target.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      target.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: "var(--navbar-h)",
        left: 0,
        right: 0,
        height: 2,
        zIndex: 199,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: `${progress}%`,
          height: "100%",
          background: "var(--accent-blue)",
          transition: "width 80ms linear",
        }}
      />
    </div>
  );
}
