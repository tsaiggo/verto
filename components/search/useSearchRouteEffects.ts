"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { searchHrefWithQuery } from "@/components/search/search-state";

interface SearchRouteEffectsOptions {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  initialQuery: string;
  inputRef: RefObject<HTMLInputElement | null>;
}

function replaceQueryUrl(query: string) {
  const href = searchHrefWithQuery(window.location.href, query);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (href !== current) window.history.replaceState(window.history.state, "", href);
}

/** Synchronize browser-only URL, clock, and keyboard behavior for Search. */
export function useSearchRouteEffects({
  query,
  setQuery,
  initialQuery,
  inputRef,
}: SearchRouteEffectsOptions): number {
  const [now, setNow] = useState(0);
  const urlReadyRef = useRef(false);

  useEffect(() => {
    const queryFromLocation = () =>
      new URLSearchParams(window.location.search).get("q")?.trim() || initialQuery;
    const syncFromLocation = () => setQuery(queryFromLocation());
    const frame = requestAnimationFrame(() => {
      const nextQuery = queryFromLocation();
      setQuery(nextQuery);
      urlReadyRef.current = true;
      replaceQueryUrl(nextQuery);
    });
    window.addEventListener("popstate", syncFromLocation);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("popstate", syncFromLocation);
    };
  }, [initialQuery, setQuery]);

  useEffect(() => {
    if (urlReadyRef.current) replaceQueryUrl(query);
  }, [query]);

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
