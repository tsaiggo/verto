"use client";

import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import {
  parseSearchRouteState,
  searchHrefWithState,
  type SearchRouteState,
} from "@/components/search/search-state";

interface SearchRouteEffectsOptions {
  state: SearchRouteState;
  onStateChange: (state: SearchRouteState) => void;
  initialQuery: string;
  inputRef: RefObject<HTMLInputElement | null>;
}

function replaceSearchUrl(state: SearchRouteState) {
  const href = searchHrefWithState(window.location.href, state);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (href !== current) window.history.replaceState(window.history.state, "", href);
}

/** Synchronize browser-only URL, clock, and keyboard behavior for Search. */
export function useSearchRouteEffects({
  state,
  onStateChange,
  initialQuery,
  inputRef,
}: SearchRouteEffectsOptions): number {
  const [now, setNow] = useState(0);
  const urlReadyRef = useRef(false);

  useEffect(() => {
    const applyLocation = (fallbackQuery: string) => {
      const nextState = parseSearchRouteState(window.location.href, fallbackQuery);
      onStateChange(nextState);
      urlReadyRef.current = true;
      replaceSearchUrl(nextState);
    };
    const syncFromHistory = () => applyLocation("");

    urlReadyRef.current = false;
    const frame = requestAnimationFrame(() => applyLocation(initialQuery));
    window.addEventListener("popstate", syncFromHistory);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("popstate", syncFromHistory);
    };
  }, [initialQuery, onStateChange]);

  useEffect(() => {
    if (urlReadyRef.current) replaceSearchUrl(state);
  }, [state]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const frame = requestAnimationFrame(tick);
    const interval = setInterval(tick, 60_000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inputRef]);

  return now;
}
