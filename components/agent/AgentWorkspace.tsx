"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { loadWebKey } from "@/lib/ai/key-store";
import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import { getStateStore } from "@/lib/state-store";
import * as agentThreadStore from "@/lib/agent-threads";
import { useRuntimeLocalIndex } from "@/components/runtime/useRuntimeLocalIndex";
import {
  AgentContext,
  AgentConversation,
  AgentHistory,
} from "@/components/agent/AgentWorkspacePanels";
import { useAgentConversation, type ThreadBinding } from "@/components/agent/useAgentConversation";
import type {
  AgentSource,
  AssistantKind,
  ThreadData,
  ThreadStore,
  WorkspaceStatus,
} from "@/components/agent/agent-types";

export type { AgentSource } from "@/components/agent/agent-types";
type ThreadGroup = { group: string; items: ThreadData[] };
type DeletedConversation = {
  thread: ThreadData;
  bindingGeneration: number;
  wasActive: boolean;
  replacementId: string | null;
};

interface AgentWorkspaceProps {
  sources: AgentSource[];
  availableSourceCount: number;
  assistantKind: AssistantKind;
  assistantModel: string;
}

function providerLabel(kind: AssistantKind, providerReady: boolean, sourcesReady: boolean): string {
  switch (kind) {
    case "none":
      return "AI setup needed";
    case "mock":
      return sourcesReady ? "Demo provider" : "No readable sources";
    case "github":
      if (!providerReady) return "Access key required";
      return sourcesReady ? "Configured Agent" : "No readable sources";
  }
}

function subscribeAssistantKey(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getAssistantKeySnapshot(): boolean {
  return Boolean(loadWebKey());
}

function getServerAssistantKeySnapshot(): boolean {
  return false;
}

function countLabel(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function runtimeSourceSubtitle(source: AgentSource): string {
  const tags = source.tags?.length ? source.tags.map((tag) => `#${tag}`).join(" ") : "No tags";
  return `${source.subtitle} · ${tags}`;
}

function useWorkspaceSources(
  staticSources: AgentSource[],
  staticAvailableSourceCount: number
): {
  sources: AgentSource[];
  availableSourceCount: number;
  status: WorkspaceStatus;
  detail: string | null;
} {
  const runtimeLocal = useRuntimeLocalIndex();

  return useMemo(() => {
    if (runtimeLocal.status === "idle") {
      return {
        sources: staticSources,
        availableSourceCount: Math.max(staticSources.length, staticAvailableSourceCount),
        status: "ready" as const,
        detail: null,
      };
    }
    if (runtimeLocal.status === "loading") {
      return {
        sources: [],
        availableSourceCount: 0,
        status: "loading" as const,
        detail: runtimeLocal.folder,
      };
    }
    if (runtimeLocal.status === "error") {
      return {
        sources: [],
        availableSourceCount: 0,
        status: "error" as const,
        detail: runtimeLocal.error,
      };
    }

    const sources = runtimeLocal.index.documents
      .filter((document) => !document.node.draft)
      .map((document) => {
        const source: AgentSource = {
          title: document.node.title,
          subtitle:
            document.node.slug.length > 1
              ? document.node.slug.slice(0, -1).join(" / ")
              : "Local Library",
          href: document.node.href,
          body: document.raw,
          tags: document.node.tags ?? [],
        };
        return { ...source, subtitle: runtimeSourceSubtitle(source) };
      });
    return {
      sources,
      availableSourceCount: sources.length,
      status: "ready" as const,
      detail: runtimeLocal.folder,
    };
  }, [runtimeLocal, staticAvailableSourceCount, staticSources]);
}

function groupThreads(threads: ThreadData[]): ThreadGroup[] {
  const groupForDate = agentThreadStore.threadGroup;
  const groups = new Map<string, ThreadData[]>();
  for (const thread of threads) {
    const label = groupForDate(thread.updatedAt);
    const existing = groups.get(label) ?? [];
    groups.set(label, [...existing, thread]);
  }
  return Array.from(groups, ([group, items]) => ({ group, items }));
}

function useAgentThreads() {
  const [initDone, setInitDone] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [binding, setBinding] = useState<ThreadBinding | null>(null);
  const bindingRef = useRef<ThreadBinding | null>(null);
  bindingRef.current = binding;
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
        // This module is browser-safe and tiny. Importing it statically avoids
        // leaving the entire Agent workspace behind a second asynchronous
        // chunk boundary after the route has already hydrated.
        const loadedStore: ThreadStore = agentThreadStore;
        const stateStore = getStateStore();
        await loadedStore.hydrateThreads(stateStore);
        if (cancelled || run !== initialization) return;

        const currentBinding = { api: loadedStore, state: stateStore, generation: run };
        const existing = loadedStore.loadThreads(stateStore);
        if (existing.length > 0) {
          setThreads(existing);
          setActiveId(existing[0].id);
        } else {
          const fresh = loadedStore.createThread(undefined, stateStore);
          setThreads([fresh]);
          setActiveId(fresh.id);
        }
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
          "Couldn’t restore portable conversations. Check this Local library’s .verto files, then reload."
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
    const thread = binding.api.createThread(undefined, binding.state);
    setActiveId(thread.id);
    reloadThreads(binding);
    return true;
  }

  function deleteConversation(id: string): DeletedConversation | null {
    const current = bindingRef.current;
    if (!current) return null;
    const thread = current.api.findThread(id, current.state);
    if (!thread || !current.api.deleteThread(id, current.state)) return null;

    const wasActive = id === activeId;
    let replacementId: string | null = null;
    if (wasActive) {
      const remaining = current.api.loadThreads(current.state);
      const nextThread = remaining[0] ?? current.api.createThread(undefined, current.state);
      if (remaining.length === 0) replacementId = nextThread.id;
      setActiveId(nextThread.id);
    }
    reloadThreads(current);
    return {
      thread,
      bindingGeneration: current.generation,
      wasActive,
      replacementId,
    };
  }

  function restoreConversation(deleted: DeletedConversation): boolean {
    const current = bindingRef.current;
    if (!current || current.generation !== deleted.bindingGeneration) return false;
    if (!current.api.restoreThread(deleted.thread, current.state)) return false;

    if (deleted.replacementId) {
      const replacement = current.api.findThread(deleted.replacementId, current.state);
      if (replacement && replacement.title === "New Chat" && replacement.messages.length === 0) {
        current.api.deleteThread(replacement.id, current.state);
      }
    }
    if (deleted.wasActive) setActiveId(deleted.thread.id);
    reloadThreads(current);
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
    restoreConversation,
  };
}

export default function AgentWorkspace({
  sources,
  availableSourceCount,
  assistantKind,
  assistantModel,
}: AgentWorkspaceProps) {
  const threadState = useAgentThreads();
  const hasAssistantKey = useSyncExternalStore(
    subscribeAssistantKey,
    getAssistantKeySnapshot,
    getServerAssistantKeySnapshot
  );
  const workspace = useWorkspaceSources(sources, availableSourceCount);
  const providerReady = assistantKind === "mock" || (assistantKind === "github" && hasAssistantKey);
  const sourcesReady = workspace.status === "ready" && workspace.sources.length > 0;
  const isReady = providerReady && sourcesReady;
  const isGrounded = assistantKind === "github" && isReady;
  const conversation = useAgentConversation({
    assistantKind,
    assistantModel,
    isReady,
    sources: workspace.sources,
    availableSourceCount: workspace.availableSourceCount,
    activeId: threadState.activeId,
    activeThread: threadState.activeThread,
    binding: threadState.binding,
  });
  const consumedPromptRef = useRef(false);

  useEffect(() => {
    if (consumedPromptRef.current || !threadState.initDone || !threadState.activeId) return;

    const url = new URL(window.location.href);
    const prompt = url.searchParams.get("prompt")?.trim();
    if (!prompt) {
      consumedPromptRef.current = true;
      return;
    }
    if (!conversation.fillStarterPrompt(prompt)) return;

    consumedPromptRef.current = true;
    url.searchParams.delete("prompt");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }, [conversation, threadState.activeId, threadState.initDone]);
  const visibleMessageCount = conversation.messages.filter(
    (message) => message.role !== "tool"
  ).length;
  const activeTitle = threadState.activeThread?.title ?? "New Chat";

  function handleNewChat() {
    conversation.invalidateRequest();
    if (threadState.createConversation()) conversation.resetConversation();
  }

  function handleThreadSelect(id: string) {
    conversation.invalidateRequest();
    threadState.setActiveId(id);
    conversation.scrollDown();
  }

  if (!threadState.initDone) {
    return (
      <div className="ag-workspace ag-workspace--loading">
        <div className="ag-loading">
          <Loader2 aria-hidden className="ag-spinner" size={24} />
          <span>Loading conversations…</span>
        </div>
      </div>
    );
  }

  if (threadState.loadError) {
    return (
      <div className="ag-workspace ag-workspace--loading">
        <div className="ag-loading" role="alert">
          <strong>Conversations are unavailable</strong>
          <span>{threadState.loadError}</span>
          <button
            type="button"
            className="v-btn v-btn--sm"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ag-workspace">
      <AgentHistory
        threads={threadState.threads}
        groups={threadState.groups}
        activeId={threadState.activeId}
        onNewChat={handleNewChat}
        onSelect={handleThreadSelect}
        onDelete={(id) => {
          if (id === threadState.activeId) conversation.invalidateRequest();
          const deleted = threadState.deleteConversation(id);
          if (!deleted) return;
          toast("Conversation deleted", {
            description: deleted.thread.title,
            action: {
              label: "Undo",
              onClick: () => {
                if (!threadState.restoreConversation(deleted)) {
                  toast.error("Couldn’t restore conversation", {
                    description: "The active Local library may have changed.",
                  });
                }
              },
            },
          });
        }}
      />
      <AgentConversation
        assistantKind={assistantKind}
        isReady={isReady}
        providerReady={providerReady}
        isGrounded={isGrounded}
        sourceCount={workspace.sources.length}
        availableSourceCount={workspace.availableSourceCount}
        workspaceStatus={workspace.status}
        activeId={threadState.activeId}
        activeTitle={activeTitle}
        activeScope={threadState.activeThread?.scope}
        providerName={providerLabel(assistantKind, providerReady, sourcesReady)}
        messageCountLabel={countLabel(visibleMessageCount, "message")}
        messages={conversation.messages}
        sending={conversation.sending}
        failure={conversation.failure}
        streamRef={conversation.streamRef}
        draftRef={conversation.draftRef}
        onPromptSelect={conversation.fillStarterPrompt}
        onSend={() => void conversation.handleSend()}
        onStop={conversation.stopRequest}
        onRestorePrompt={conversation.restoreFailedPrompt}
        onRetry={conversation.retryFailedPrompt}
      />
      <AgentContext
        sources={workspace.sources.slice(0, 6)}
        sourceCount={workspace.sources.length}
        availableSourceCount={workspace.availableSourceCount}
        isReady={isReady}
        isGrounded={isGrounded}
        status={workspace.status}
        detail={workspace.detail}
      />
    </div>
  );
}
