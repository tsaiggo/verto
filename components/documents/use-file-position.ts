"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStateStore } from "@/lib/state-store";
import { saveReadingEntry } from "@/lib/reading-state";
import type { ImportedDocument } from "@/lib/imported-documents";
import { importedDocumentHref } from "@/lib/imported-documents";

const STORE = "document-positions";
interface FilePosition {
  index: number;
  scrollTop: number;
}
function validPosition(value: unknown): FilePosition {
  const candidate = value as Partial<FilePosition> | undefined;
  return {
    index: Number.isInteger(candidate?.index) && candidate!.index! >= 0 ? candidate!.index! : 0,
    scrollTop:
      typeof candidate?.scrollTop === "number" && Number.isFinite(candidate.scrollTop)
        ? Math.max(0, candidate.scrollTop)
        : 0,
  };
}

/** Chapter/page positions travel through the existing portable state adapter. */
export function useFilePosition(document: ImportedDocument, count: number) {
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<FilePosition>({ index: 0, scrollTop: 0 });
  const restore = useRef<number | null>(0);
  const scroller = useRef<HTMLElement | null>(null);
  const initialized = useRef(false);
  const save = useCallback(async () => {
    if (!initialized.current) return;
    const value = { ...latest.current };
    try {
      await getStateStore().update<Record<string, FilePosition>>(STORE, {}, (current) => ({
        ...current,
        [document.id]: value,
      }));
      const scroll = scroller.current;
      const within =
        scroll && scroll.scrollHeight > scroll.clientHeight
          ? Math.min(1, value.scrollTop / (scroll.scrollHeight - scroll.clientHeight))
          : 1;
      await saveReadingEntry({
        href: importedDocumentHref(document.id),
        slug: ["files", document.id],
        title: document.title,
        path: document.filename,
        lastReadAt: new Date().toISOString(),
        progress: Math.min(100, ((value.index + within) / count) * 100),
        scrollTop: value.scrollTop,
      });
      setError(null);
    } catch {
      setError("Your reading position couldn’t be saved. The original document is unchanged.");
    }
  }, [count, document.id, document.title, document.filename]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const store = getStateStore();
        await store.hydrate?.(STORE);
        if (!active) return;
        const positions = store.read<Record<string, unknown>>(STORE, {});
        const saved = validPosition(positions[document.id]);
        saved.index = Math.min(count - 1, saved.index);
        latest.current = saved;
        restore.current = saved.scrollTop;
        initialized.current = true;
        setIndex(saved.index);
        setReady(true);
      } catch {
        if (active) {
          setError(
            "Your previous reading position couldn’t be restored. Reading remains available."
          );
          setReady(true);
        }
      }
    })();
    return () => {
      active = false;
      void save();
    };
  }, [document.id, count, save]);

  const choose = useCallback(
    (next: number) => {
      const clamped = Math.min(count - 1, Math.max(0, next));
      latest.current = { index: clamped, scrollTop: 0 };
      restore.current = 0;
      setIndex(clamped);
      scroller.current?.scrollTo({ top: 0, behavior: "auto" });
      void save();
    },
    [count, save]
  );

  const bind = useCallback((element: HTMLElement | null) => {
    scroller.current = element;
  }, []);
  const restoreScroll = useCallback(() => {
    if (!ready || !scroller.current || restore.current === null) return;
    scroller.current.scrollTo({ top: restore.current, behavior: "auto" });
    latest.current.scrollTop = scroller.current.scrollTop;
    restore.current = null;
    void save();
  }, [ready, save]);
  useEffect(() => {
    if (!ready) return;
    const element = scroller.current;
    if (!element) return;
    let timer = 0;
    const onScroll = () => {
      latest.current.scrollTop = element.scrollTop;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void save(), 300);
    };
    const onHide = () => {
      latest.current.scrollTop = element.scrollTop;
      void save();
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", onHide);
    return () => {
      window.clearTimeout(timer);
      element.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onHide);
    };
  }, [ready, save]);
  return { index, ready, error, choose, bind, restoreScroll };
}
