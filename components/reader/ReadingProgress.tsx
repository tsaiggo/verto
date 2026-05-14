"use client";

import { useEffect, useState } from "react";

/**
 * Thin progress bar fixed under the navbar that fills as the page scrolls.
 * Mounts only on the client so it never participates in hydration.
 */
export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function update() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const pct = max > 0 ? Math.min(100, (doc.scrollTop / max) * 100) : 0;
      setProgress(pct);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
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
