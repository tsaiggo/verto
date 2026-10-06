"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { parseCitationHash } from "@/lib/agent-content/blocks";
import { contentVersion } from "@/lib/agent-content/identity";
import { findAgentCitationTarget, focusAgentCitationTarget } from "./agent-citation-target";

const HISTORY_HASH_EVENT = "verto:history-hash-change";
const observedHistories = new WeakSet<History>();

/** Next.js and native history pushes can update a fragment without hashchange.
 * Preserve their existing history handlers and publish only actual hash changes.
 * The shared wrapper holds no component callbacks after a Reader unmounts. */
function observeHistoryHash() {
  const history = window.history;
  if (observedHistories.has(history)) return;
  observedHistories.add(history);
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function (...args: Parameters<History[typeof method]>) {
      const before = window.location.hash;
      original.apply(this, args);
      if (window.location.hash !== before) window.dispatchEvent(new Event(HISTORY_HASH_EVENT));
    };
  }
}

function subscribeHash(callback: () => void) {
  observeHistoryHash();
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  window.addEventListener(HISTORY_HASH_EVENT, callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("popstate", callback);
    window.removeEventListener(HISTORY_HASH_EVENT, callback);
  };
}
const currentHash = () => (typeof window === "undefined" ? "" : window.location.hash);

export default function AgentCitationLocator({
  source,
  revision,
}: {
  source?: string;
  revision?: number | string;
}) {
  const marker = useRef<HTMLDivElement>(null);
  const hash = useSyncExternalStore(subscribeHash, currentHash, () => "");
  const citation = useMemo(() => parseCitationHash(hash), [hash]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!citation) return;
    const root = marker.current?.parentElement;
    if (!root) return;
    let active = true;
    let observer: MutationObserver | undefined;
    let timer = 0;
    let target: HTMLElement | null = null;
    const run = async () => {
      const version = source === undefined ? undefined : await contentVersion(source, revision);
      if (!active) return;
      const locate = () => {
        if (!active) return false;
        const found = findAgentCitationTarget(root, citation, source, version);
        if (!found) return false;
        target = found;
        focusAgentCitationTarget(found);
        setNotice(
          version && version !== citation.version
            ? "This document has changed since the answer. The quoted passage was found in the current version."
            : !version
              ? "Quoted passage found. The source version could not be verified."
              : null
        );
        observer?.disconnect();
        return true;
      };
      if (locate()) return;
      observer = new MutationObserver(locate);
      observer.observe(root, { childList: true, subtree: true });
      timer = window.setTimeout(() => {
        observer?.disconnect();
        if (active && !target)
          setNotice(
            "The cited passage could not be located in this version. Review the current document before relying on this reference."
          );
      }, 2500);
    };
    void run().catch(() => {
      if (active) setNotice("The citation could not be verified. Review the current document.");
    });
    return () => {
      active = false;
      observer?.disconnect();
      window.clearTimeout(timer);
      target?.removeAttribute("data-agent-source-active");
    };
  }, [citation, source, revision]);

  return (
    <div ref={marker} data-agent-citation-locator>
      {citation && notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
