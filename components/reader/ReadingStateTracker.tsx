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
const RESTORE_LAYOUT_TIMEOUT_MS = 2000;

/** Application restore owns the offset only until media settles or reading input starts. */
function restoreReadingPosition(scroller: HTMLElement, top: number, onFinish: () => void) {
  const previousAnchor = scroller.style.getPropertyValue("overflow-anchor");
  const previousPriority = scroller.style.getPropertyPriority("overflow-anchor");
  const images = Array.from(scroller.querySelectorAll("img")).filter((image) => !image.complete);
  const pending = new Set(images);
  let active = true;
  let applied = false;
  let frame = 0;
  let settling = false;
  let expired = false;
  scroller.style.setProperty("overflow-anchor", "none");

  function stop(notify = true) {
    if (!active) return;
    active = false;
    window.clearTimeout(timeout);
    window.cancelAnimationFrame(frame);
    images.forEach((image) => {
      image.removeEventListener("load", mediaSettled);
      image.removeEventListener("error", mediaSettled);
    });
    scroller.removeEventListener("wheel", onReadingInput);
    scroller.removeEventListener("touchstart", onReadingInput);
    scroller.removeEventListener("pointerdown", onReadingInput, true);
    document.removeEventListener("keydown", onReadingKey);
    if (scroller.style.getPropertyValue("overflow-anchor") === "none") {
      if (previousAnchor)
        scroller.style.setProperty("overflow-anchor", previousAnchor, previousPriority);
      else scroller.style.removeProperty("overflow-anchor");
    }
    if (notify) onFinish();
  }

  function settle() {
    if (!active || !applied || settling) return;
    settling = true;
    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        if (!active) return;
        scroller.scrollTo({ top, behavior: "auto" });
        stop();
      });
    });
  }

  function mediaSettled(event: Event) {
    pending.delete(event.currentTarget as HTMLImageElement);
    if (!pending.size) settle();
  }
  function onReadingInput() {
    stop();
  }
  function onReadingKey(event: KeyboardEvent) {
    if (!new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]).has(event.key))
      return;
    if (
      event.target instanceof Element &&
      event.target.closest("input, textarea, [contenteditable]")
    )
      return;
    stop();
  }
  images.forEach((image) => {
    image.addEventListener("load", mediaSettled);
    image.addEventListener("error", mediaSettled);
  });
  scroller.addEventListener("wheel", onReadingInput, { passive: true });
  scroller.addEventListener("touchstart", onReadingInput, { passive: true });
  scroller.addEventListener("pointerdown", onReadingInput, { passive: true, capture: true });
  document.addEventListener("keydown", onReadingKey);
  const timeout = window.setTimeout(() => {
    expired = true;
    settle();
  }, RESTORE_LAYOUT_TIMEOUT_MS);
  frame = window.requestAnimationFrame(() => {
    if (!active) return;
    scroller.scrollTo({ top, behavior: "auto" });
    applied = true;
    if (!pending.size || expired) settle();
  });
  return () => stop(false);
}

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
    let restoring = false;
    let cancelRestore: (() => void) | null = null;
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
      if (restoring) return;
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
        restoring = true;
        cancelRestore = restoreReadingPosition(activeScroller, saved.scrollTop, () => {
          restoring = false;
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
      cancelRestore?.();
      target?.removeEventListener("scroll", saveSoon);
      window.removeEventListener("resize", saveSoon);
      window.removeEventListener("pagehide", saveNow);
      if (initialized) saveNow();
    };
  }, [href, path, slug, title]);

  return null;
}
