"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import { loadWebKey } from "@/lib/ai/key-store";
import { useRuntimeLocalIndex } from "@/components/runtime/useRuntimeLocalIndex";
import {
  AgentContext,
  AgentConversation,
  AgentHistory,
} from "@/components/agent/AgentWorkspacePanels";
import { useAgentConversation } from "@/components/agent/useAgentConversation";
import { useAgentThreads } from "@/components/agent/useAgentThreads";
import { useAgentPromptFromUrl } from "@/components/agent/useAgentPromptFromUrl";
import type { AgentSource, AssistantKind, WorkspaceStatus } from "@/components/agent/agent-types";
import { Button } from "@/components/ui/button";
import { ContentEmptyState } from "@/components/ui/content-primitives";

export type { AgentSource } from "@/components/agent/agent-types";

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
  useAgentPromptFromUrl({
    ready:
      threadState.initDone &&
      !threadState.loadError &&
      Boolean(threadState.activeId && threadState.binding),
    fillPrompt: conversation.fillStarterPrompt,
  });
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
        <ContentEmptyState
          compact
          icon={<Loader2 aria-hidden className="content-status__spinner" />}
          title="Loading conversations"
          description="Restoring portable workspace threads from this library."
        />
      </div>
    );
  }

  if (threadState.loadError) {
    return (
      <div className="ag-workspace ag-workspace--loading">
        <ContentEmptyState
          compact
          role="alert"
          title="Conversations are unavailable"
          description={threadState.loadError}
          action={
            <Button type="button" size="sm" onClick={() => window.location.reload()}>
              Reload
            </Button>
          }
        />
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
          const title =
            threadState.threads.find((thread) => thread.id === id)?.title ?? "conversation";
          if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
          if (threadState.deleteConversation(id) && id === threadState.activeId) {
            conversation.invalidateRequest();
          }
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
        providerName={providerLabel(assistantKind, providerReady, sourcesReady)}
        messageCountLabel={countLabel(visibleMessageCount, "message")}
        messages={conversation.messages}
        sending={conversation.sending}
        streamRef={conversation.streamRef}
        draftRef={conversation.draftRef}
        onPromptSelect={conversation.fillStarterPrompt}
        onSend={() => void conversation.handleSend()}
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
