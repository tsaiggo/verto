"use client";

import { useEffect } from "react";
import {
  computeScrollProgress,
  loadReadingState,
  saveReadingEntry,
  type ReadingEntry,
} from "@/lib/reading-state";
import {
  getReadingScrollElement,
  getReadingScrollEventTarget,
} from "@/lib/reading-scroll";

interface ReadingStateTrackerProps {
  href: string;
  slug: string[];
  title: string;
  path: string;
}

function currentProgress() {
  return computeScrollProgress(getReadingScrollElement());
}

function buildEntry(props: ReadingStateTrackerProps): ReadingEntry {
  const { progress, scrollTop } = currentProgress();
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
    const entryProps = { href, path, slug, title };
    const saved = loadReadingState().recent.find((entry) => entry.href === href);
    const scroller = getReadingScrollElement();
    const target = getReadingScrollEventTarget(scroller);

    function saveSoon() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        saveReadingEntry(buildEntry(entryProps));
      });
    }

    function saveNow() {
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      saveReadingEntry(buildEntry(entryProps));
    }

    if (!window.location.hash && saved && saved.scrollTop > 0) {
      window.requestAnimationFrame(() => {
        scroller.scrollTo({ top: saved.scrollTop, behavior: "auto" });
        saveSoon();
      });
    } else {
      saveSoon();
    }

    target.addEventListener("scroll", saveSoon, { passive: true });
    window.addEventListener("resize", saveSoon);
    window.addEventListener("pagehide", saveNow);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      target.removeEventListener("scroll", saveSoon);
      window.removeEventListener("resize", saveSoon);
      window.removeEventListener("pagehide", saveNow);
    };
  }, [href, path, slug, title]);

  return null;
}
