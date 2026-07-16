"use client";

import { useEffect } from "react";

interface AgentPromptFromUrlOptions {
  ready: boolean;
  fillPrompt: (prompt: string) => boolean;
}

function currentRelativeHref(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

/**
 * Prefill a newly initialized Agent composer from Search without submitting it.
 * The prompt parameter is removed only after the composer accepts the value, so
 * a slow thread-store initialization cannot lose the handoff.
 */
export function useAgentPromptFromUrl({ ready, fillPrompt }: AgentPromptFromUrlOptions) {
  useEffect(() => {
    if (!ready) return;

    const url = new URL(window.location.href);
    const routePrompt = url.searchParams.get("prompt");
    if (routePrompt === null) return;

    const prompt = routePrompt.trim();
    if (prompt && !fillPrompt(prompt)) return;

    url.searchParams.delete("prompt");
    const nextHref = `${url.pathname}${url.search}${url.hash}`;
    if (nextHref !== currentRelativeHref()) {
      window.history.replaceState(window.history.state, "", nextHref);
    }
  }, [fillPrompt, ready]);
}
