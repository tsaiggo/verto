"use client";

import { useEffect } from "react";
import {
  computeScrollProgress,
  hydrateReadingState,
  saveReadingEntry,
  type ReadingEntry,
} from "@/lib/reading-state";
import { getReadingScrollElement, getReadingScrollEventTarget } from "@/lib/reading-scroll";

interface ReadingStateTrackerProps {
  href: string;
  slug: string[];
  title: string;
  path: string;
}

const SAVE_INTERVAL_MS = 300;

function buildEntry(props: ReadingStateTrackerProps, scroller: HTMLElement): ReadingEntry {
  const { progress, scrollTop } = computeScrollProgress(scroller);
  return {
    ...props,
    lastReadAt: new Date().toISOString(),
    progress,
    scrollTop,
  };
}

export default function ReadingStateTracker(props: ReadingStateTrackerProps) {
  const { href, path, slug, title } = props;

  useEffect(() => {
    let frame = 0;
    let timer = 0;
    let lastSavedAt = 0;
    let initialized = false;
    let disposed = false;
    let target: ReturnType<typeof getReadingScrollEventTarget> | null = null;
    let scroller: HTMLElement | null = null;
    let latestEntry: ReadingEntry | null = null;
    const entryProps = { href, path, slug, title };

    function captureLatestEntry() {
      if (scroller) latestEntry = buildEntry(entryProps, scroller);
    }

    function persistLatestEntry() {
      if (!latestEntry) return;
      void saveReadingEntry(latestEntry).catch(() => {});
    }

    function saveSoon() {
      // Capture from the reader immediately. The timer only throttles the
      // durable write; a route transition may replace [data-page-scroll]
      // before this effect's cleanup runs.
      captureLatestEntry();
      if (frame || timer) return;
      const delay = Math.max(0, SAVE_INTERVAL_MS - (Date.now() - lastSavedAt));
      timer = window.setTimeout(() => {
        timer = 0;
        frame = window.requestAnimationFrame(() => {
          frame = 0;
          lastSavedAt = Date.now();
          persistLatestEntry();
        });
      }, delay);
    }

    function saveNow() {
      if (timer) {
        window.clearTimeout(timer);
        timer = 0;
      }
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      lastSavedAt = Date.now();
      // Flush the last progress observed on the bound reader. Re-querying the
      // DOM here can accidentally read the destination route's scroll region.
      persistLatestEntry();
    }

    async function initialize() {
      // A portable desktop vault is restored asynchronously. Wait before the
      // first automatic save so an empty local cache cannot overwrite the
      // progress that travelled with the vault.
      let state;
      try {
        state = await hydrateReadingState();
      } catch {
        // The StateStore already surfaced a recovery toast. Do not write an
        // empty fallback over unreadable portable progress.
        return;
      }
      if (disposed) return;
      initialized = true;

      const saved = state.byHref[href];
      const activeScroller = getReadingScrollElement();
      scroller = activeScroller;
      target = getReadingScrollEventTarget(activeScroller);

      if (!window.location.hash && saved && saved.scrollTop > 0) {
        window.requestAnimationFrame(() => {
          if (disposed) return;
          activeScroller.scrollTo({ top: saved.scrollTop, behavior: "auto" });
          saveSoon();
        });
      } else {
        saveSoon();
      }

      target.addEventListener("scroll", saveSoon, { passive: true });
      window.addEventListener("resize", saveSoon);
      window.addEventListener("pagehide", saveNow);
    }

    void initialize();

    return () => {
      disposed = true;
      target?.removeEventListener("scroll", saveSoon);
      window.removeEventListener("resize", saveSoon);
      window.removeEventListener("pagehide", saveNow);
      if (initialized) saveNow();
    };
  }, [href, path, slug, title]);

  return null;
}
