"use client";

import { useEffect, useState } from "react";
import AgentWorkspace from "@/components/agent/AgentWorkspace";
import type { AgentSource, AssistantKind } from "@/components/agent/agent-types";
import styles from "./AgentWorkspace.module.css";

interface AgentSourcePayload {
  sources: AgentSource[];
  availableSourceCount: number;
}

function isAgentSourcePayload(value: unknown): value is AgentSourcePayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.sources) && typeof record.availableSourceCount === "number";
}

export default function StandaloneAgent({
  assistantKind,
  assistantModel,
}: {
  assistantKind: AssistantKind;
  assistantModel: string;
}) {
  const [payload, setPayload] = useState<AgentSourcePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (payload) return;
    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/agent-sources.json", { signal: controller.signal });
        if (!response.ok) throw new Error(`Source request failed (${response.status})`);
        const result: unknown = await response.json();
        if (!isAgentSourcePayload(result)) throw new Error("Invalid Agent source response");
        if (cancelled) return;
        setPayload(result);
        setError(null);
      } catch {
        if (!cancelled) setError("Couldn’t load Agent sources. Check the connection and retry.");
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [payload, retry]);

  if (error) {
    return (
      <div className={styles.standaloneState} role="alert">
        <strong>Agent sources are unavailable</strong>
        <span>{error}</span>
        <button
          type="button"
          className={styles.textButton}
          onClick={() => {
            setError(null);
            setRetry((n) => n + 1);
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className={styles.standaloneState} role="status">
        Loading Agent sources…
      </div>
    );
  }

  return (
    <AgentWorkspace
      sources={payload.sources}
      availableSourceCount={payload.availableSourceCount}
      assistantKind={assistantKind}
      assistantModel={assistantModel}
    />
  );
}
