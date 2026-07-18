"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import { getStateStore } from "@/lib/state-store";
import {
  loadOrCreateThreads,
  recoverCreatedThread,
  recoverDeletedThreads,
  type ThreadBinding,
} from "@/components/agent/agent-persistence";
import type { ThreadData, ThreadStore } from "@/components/agent/agent-types";

type ThreadGroup = { group: string; items: ThreadData[] };

/** Lazy store — set after the dynamic import in useAgentThreads. */
let threadStoreModule: ThreadStore | null = null;

function groupThreads(threads: ThreadData[]): ThreadGroup[] {
  const groupForDate = threadStoreModule?.threadGroup ?? (() => "Today");
  const groups = new Map<string, ThreadData[]>();
  for (const thread of threads) {
    const label = groupForDate(thread.updatedAt);
    const existing = groups.get(label) ?? [];
    groups.set(label, [...existing, thread]);
  }
  return Array.from(groups, ([group, items]) => ({ group, items }));
}

export function useAgentThreads() {
  const [initDone, setInitDone] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [binding, setBinding] = useState<ThreadBinding | null>(null);
  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeId) ?? null,
    [threads, activeId]
  );

  function reloadThreads(current: ThreadBinding | null = binding) {
    if (current) setThreads(current.api.loadThreads(current.state));
  }

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let initialization = 0;

    async function initializeStore() {
      const run = ++initialization;
      unsubscribe?.();
      unsubscribe = undefined;
      setInitDone(false);
      setLoadError(null);
      setBinding(null);

      try {
        const loadedStore = threadStoreModule ?? (await import("@/lib/agent-threads"));
        threadStoreModule = loadedStore;
        const stateStore = getStateStore();
        await loadedStore.hydrateThreads(stateStore);
        if (cancelled || run !== initialization) return;

        const currentBinding = { api: loadedStore, state: stateStore, generation: run };
        const available = loadOrCreateThreads(loadedStore, stateStore);
        setThreads(available);
        setActiveId(available[0]?.id ?? null);
        setBinding(currentBinding);
        unsubscribe = loadedStore.subscribeThreads(() => {
          if (cancelled) return;
          const nextThreads = loadedStore.loadThreads(stateStore);
          setThreads(nextThreads);
          setActiveId((current) =>
            current && nextThreads.some((thread) => thread.id === current)
              ? current
              : (nextThreads[0]?.id ?? null)
          );
        }, stateStore);
        setInitDone(true);
      } catch {
        if (cancelled || run !== initialization) return;
        setThreads([]);
        setActiveId(null);
        setLoadError(
          "Couldn’t restore portable conversations. Check this library’s .verto files, then reload."
        );
        setInitDone(true);
      }
    }

    void initializeStore();
    const onFolderChanged = () => {
      setThreads([]);
      setActiveId(null);
      setBinding(null);
      void initializeStore();
    };
    window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, onFolderChanged);
    return () => {
      cancelled = true;
      initialization += 1;
      window.removeEventListener(LOCAL_FOLDER_CHANGED_EVENT, onFolderChanged);
      unsubscribe?.();
    };
  }, []);

  function createConversation(): boolean {
    if (!binding) return false;
    const previousIds = new Set(binding.api.loadThreads(binding.state).map((thread) => thread.id));

    try {
      const thread = binding.api.createThread(undefined, binding.state);
      setActiveId(thread.id);
      reloadThreads(binding);
      return true;
    } catch {
      const recovered = recoverCreatedThread(binding, previousIds);
      if (recovered) {
        setThreads(recovered.threads);
        setActiveId(recovered.thread.id);
        return true;
      }
      toast.error("Couldn't create conversation", {
        description: "Check local storage, then try again.",
      });
      return false;
    }
  }

  function deleteConversation(id: string): boolean {
    if (!binding) return false;
    let remaining: ThreadData[] | null;

    try {
      binding.api.deleteThread(id, binding.state);
      remaining = binding.api.loadThreads(binding.state);
    } catch {
      remaining = recoverDeletedThreads(binding, id);
    }
    if (!remaining) {
      toast.error("Couldn't delete conversation", {
        description: "The conversation is still here. Check local storage, then try again.",
      });
      return false;
    }

    if (id === activeId) {
      if (remaining[0]) {
        setActiveId(remaining[0].id);
      } else {
        setActiveId(null);
        setThreads([]);
        return createConversation();
      }
    }
    setThreads(remaining);
    return true;
  }

  return {
    initDone,
    loadError,
    threads,
    activeId,
    setActiveId,
    activeThread,
    binding,
    groups: useMemo(() => groupThreads(threads), [threads]),
    createConversation,
    deleteConversation,
  };
}
