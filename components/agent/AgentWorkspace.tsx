"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import { loadWebKey } from "@/lib/ai/key-store";
import { useRuntimeLocalIndex } from "@/components/runtime/useRuntimeLocalIndex";
import {
  AgentContext,
  AgentConversation,
  AgentHistory,
} from "@/components/agent/AgentWorkspacePanels";
import { agentReply, getAgentReply } from "@/components/agent/agent-replies";
import type {
  AgentSource,
  AssistantKind,
  ThreadData,
  ThreadMessage,
  ThreadStore,
  WorkspaceStatus,
} from "@/components/agent/agent-types";

export type { AgentSource } from "@/components/agent/agent-types";
type ThreadGroup = { group: string; items: ThreadData[] };

interface AgentWorkspaceProps {
  sources: AgentSource[];
  assistantKind: AssistantKind;
}

/** Lazy store — set after the dynamic import in useAgentThreads. */
let store: ThreadStore | null = null;

function providerLabel(kind: AssistantKind, providerReady: boolean, sourcesReady: boolean): string {
  switch (kind) {
    case "none":
      return "Provider disabled";
    case "mock":
      return sourcesReady ? "Demo provider" : "No readable sources";
    case "github":
      if (!providerReady) return "Access key required";
      return sourcesReady ? "Configured assistant" : "No readable sources";
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

function useWorkspaceSources(staticSources: AgentSource[]): {
  sources: AgentSource[];
  status: WorkspaceStatus;
  detail: string | null;
} {
  const runtimeLocal = useRuntimeLocalIndex();

  return useMemo(() => {
    if (runtimeLocal.status === "idle") {
      return { sources: staticSources, status: "ready" as const, detail: null };
    }
    if (runtimeLocal.status === "loading") {
      return { sources: [], status: "loading" as const, detail: runtimeLocal.folder };
    }
    if (runtimeLocal.status === "error") {
      return { sources: [], status: "error" as const, detail: runtimeLocal.error };
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
    return { sources, status: "ready" as const, detail: runtimeLocal.folder };
  }, [runtimeLocal, staticSources]);
}

function groupThreads(threads: ThreadData[]): ThreadGroup[] {
  const groupForDate = store?.threadGroup ?? (() => "Today");
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
  const [threads, setThreads] = useState<ThreadData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeId) ?? null,
    [threads, activeId]
  );

  function reloadThreads() {
    if (store) setThreads(store.loadThreads());
  }

  useEffect(() => {
    let cancelled = false;

    async function initializeStore() {
      const loadedStore = store ?? (await import("@/lib/agent-threads"));
      store = loadedStore;
      if (cancelled) return;

      const existing = loadedStore.loadThreads();
      if (existing.length > 0) {
        setThreads(existing);
        setActiveId(existing[0].id);
      } else {
        const fresh = loadedStore.createThread(undefined);
        setThreads([fresh]);
        setActiveId(fresh.id);
      }
      setInitDone(true);
    }

    void initializeStore();
    return () => {
      cancelled = true;
    };
  }, []);

  function createConversation(): boolean {
    if (!store) return false;
    const thread = store.createThread(undefined);
    setActiveId(thread.id);
    reloadThreads();
    return true;
  }

  function deleteConversation(id: string) {
    if (!store) return;
    store.deleteThread(id);
    if (id === activeId) {
      const remaining = store.loadThreads();
      const nextThread = remaining[0] ?? store.createThread(undefined);
      setActiveId(nextThread.id);
    }
    reloadThreads();
  }

  return {
    initDone,
    threads,
    activeId,
    setActiveId,
    activeThread,
    groups: useMemo(() => groupThreads(threads), [threads]),
    createConversation,
    deleteConversation,
  };
}

interface ConversationOptions {
  assistantKind: AssistantKind;
  isReady: boolean;
  sources: AgentSource[];
  activeId: string | null;
  activeThread: ThreadData | null;
}

function useAgentConversation({
  assistantKind,
  isReady,
  sources,
  activeId,
  activeThread,
}: ConversationOptions) {
  const streamRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLInputElement>(null);
  const [localMessages, setLocalMessages] = useState<ThreadMessage[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setLocalMessages(activeThread?.messages ?? []);
  }, [activeThread]);

  function scrollDown() {
    requestAnimationFrame(() => {
      streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  function resetConversation() {
    setLocalMessages([]);
    draftRef.current?.focus();
    scrollDown();
  }

  function fillStarterPrompt(prompt: string) {
    if (!activeId || sending || !draftRef.current) return;
    draftRef.current.value = prompt;
    draftRef.current.focus();
  }

  async function handleSend() {
    const storeRef = store;
    const prompt = draftRef.current?.value?.trim();
    if (!storeRef || !activeId || !prompt || sending || !isReady || assistantKind === "none") {
      return;
    }

    const userMessage: ThreadMessage = { id: storeRef.newId(), role: "user", text: prompt };
    setLocalMessages((messages) => [...messages, userMessage]);
    storeRef.addMessage(activeId, userMessage);
    setSending(true);
    if (draftRef.current) draftRef.current.value = "";
    scrollDown();

    try {
      const reply = await getAgentReply({
        kind: assistantKind,
        store: storeRef,
        activeThread,
        prompt,
        sources,
      });
      setLocalMessages((messages) => [...messages, reply]);
      storeRef.addMessage(activeId, reply);
    } catch (error) {
      console.error("Agent chat error:", error);
      const message = agentReply(
        storeRef,
        "Sorry, something went wrong while processing your request."
      );
      setLocalMessages((messages) => [...messages, message]);
      storeRef.addMessage(activeId, message);
    } finally {
      setSending(false);
      scrollDown();
    }
  }

  return {
    streamRef,
    draftRef,
    localMessages,
    sending,
    scrollDown,
    resetConversation,
    fillStarterPrompt,
    handleSend,
  };
}

export default function AgentWorkspace({ sources, assistantKind }: AgentWorkspaceProps) {
  const threadState = useAgentThreads();
  const hasAssistantKey = useSyncExternalStore(
    subscribeAssistantKey,
    getAssistantKeySnapshot,
    getServerAssistantKeySnapshot
  );
  const workspace = useWorkspaceSources(sources);
  const providerReady = assistantKind === "mock" || (assistantKind === "github" && hasAssistantKey);
  const sourcesReady = workspace.status === "ready" && workspace.sources.length > 0;
  const isReady = providerReady && sourcesReady;
  const isGrounded = assistantKind === "github" && isReady;
  const conversation = useAgentConversation({
    assistantKind,
    isReady,
    sources: workspace.sources,
    activeId: threadState.activeId,
    activeThread: threadState.activeThread,
  });
  const visibleMessageCount = conversation.localMessages.filter(
    (message) => message.role !== "tool"
  ).length;
  const activeTitle = threadState.activeThread?.title ?? "New Chat";

  function handleNewChat() {
    if (threadState.createConversation()) conversation.resetConversation();
  }

  function handleThreadSelect(id: string) {
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

  return (
    <div className="ag-workspace">
      <AgentHistory
        threads={threadState.threads}
        groups={threadState.groups}
        activeId={threadState.activeId}
        onNewChat={handleNewChat}
        onSelect={handleThreadSelect}
        onDelete={threadState.deleteConversation}
      />
      <AgentConversation
        assistantKind={assistantKind}
        isReady={isReady}
        providerReady={providerReady}
        isGrounded={isGrounded}
        sourceCount={workspace.sources.length}
        workspaceStatus={workspace.status}
        activeId={threadState.activeId}
        activeTitle={activeTitle}
        providerName={providerLabel(assistantKind, providerReady, sourcesReady)}
        messageCountLabel={countLabel(visibleMessageCount, "message")}
        messages={conversation.localMessages}
        sending={conversation.sending}
        streamRef={conversation.streamRef}
        draftRef={conversation.draftRef}
        onPromptSelect={conversation.fillStarterPrompt}
        onSend={() => void conversation.handleSend()}
      />
      <AgentContext
        sources={workspace.sources.slice(0, 6)}
        sourceCount={workspace.sources.length}
        isReady={isReady}
        isGrounded={isGrounded}
        status={workspace.status}
        detail={workspace.detail}
      />
    </div>
  );
}
