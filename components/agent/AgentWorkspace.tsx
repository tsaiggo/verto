"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";
import { loadWebKey } from "@/lib/ai/key-store";
import { useRuntimeLocalIndex } from "@/components/runtime/useRuntimeLocalIndex";
import type { AgentStep } from "@/lib/ai/agent";
import {
  AgentContext,
  AgentConversation,
  AgentHistory,
} from "@/components/agent/AgentWorkspacePanels";

export interface AgentCitation {
  index: number;
  label: string;
  href: string;
}

export interface AgentListItem {
  term: string;
  text: string;
}

export interface AgentMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  list?: AgentListItem[];
  citations?: AgentCitation[];
}

export interface AgentSource {
  title: string;
  subtitle: string;
  href: string;
  body: string;
  tags?: string[];
}

type AssistantKind = "none" | "mock" | "github";
type ThreadStore = typeof import("@/lib/agent-threads");
type ThreadData = import("@/lib/agent-threads").AgentThreadData;
type ThreadMessage = import("@/lib/agent-threads").AgentThreadMessage;
type ThreadGroup = { group: string; items: ThreadData[] };

interface AgentWorkspaceProps {
  sources: AgentSource[];
  assistantKind: AssistantKind;
}

interface AgentReplyRequest {
  kind: Exclude<AssistantKind, "none">;
  store: ThreadStore;
  activeThread: ThreadData | null;
  prompt: string;
  sources: AgentSource[];
}

type WorkspaceStatus = "ready" | "loading" | "error";

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

function sourceCitationsForSteps(sources: AgentSource[], steps: AgentStep[]): AgentCitation[] {
  const readHrefs = new Set<string>();
  for (const step of steps) {
    if (step.name !== "read_workspace_source") continue;
    try {
      const value: unknown = JSON.parse(step.args);
      if (value && typeof value === "object" && "href" in value) {
        const href = (value as { href?: unknown }).href;
        if (typeof href === "string") readHrefs.add(href);
      }
    } catch {
      // A malformed tool call cannot justify a citation.
    }
  }

  return sources
    .filter((source) => readHrefs.has(source.href))
    .slice(0, 3)
    .map((source, index) => ({ index: index + 1, label: source.title, href: source.href }));
}

function agentReply(
  storeRef: ThreadStore,
  text: string,
  citations: AgentCitation[] = []
): ThreadMessage {
  const reply: ThreadMessage = { id: storeRef.newId(), role: "agent", text };
  return citations.length > 0 ? { ...reply, citations } : reply;
}

function threadHistory(storeRef: ThreadStore, activeThread: ThreadData | null) {
  return activeThread
    ? activeThread.messages.map((message) => storeRef.toChatMessage(message))
    : [];
}

async function mockReply(request: AgentReplyRequest): Promise<ThreadMessage> {
  const [mockMod, agentMod, libraryMod] = await Promise.all([
    import("@/lib/ai/mock"),
    import("@/lib/ai/agent"),
    import("@/lib/ai/tools/library"),
  ]);
  const result = await agentMod.runAgent(
    mockMod.createMockProvider(),
    libraryMod.READING_TOOLS,
    [
      ...threadHistory(request.store, request.activeThread),
      { role: "user" as const, content: request.prompt },
    ],
    libraryMod.readingToolCtx(null)
  );
  return agentReply(request.store, result.content || "Done.");
}

async function githubReply(request: AgentReplyRequest): Promise<ThreadMessage> {
  const [keyStore, agentMod, providerMod, workspaceMod] = await Promise.all([
    import("@/lib/ai/key-store"),
    import("@/lib/ai/agent"),
    import("@/lib/ai/index"),
    import("@/lib/ai/tools/workspace"),
  ]);
  const token = keyStore.loadWebKey();
  if (!token) {
    return agentReply(
      request.store,
      "Add an assistant access key in Settings before starting a conversation."
    );
  }

  const hasTauri =
    typeof window !== "undefined" &&
    typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== "undefined";
  const provider = providerMod.createAssistantProvider({
    kind: "github",
    token,
    fetchImpl: hasTauri
      ? async (url: RequestInfo | URL, init?: RequestInit) => {
          const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
          return tauriFetch(url.toString(), init as Record<string, unknown>);
        }
      : window.fetch.bind(window),
  });
  const result = await agentMod.runAgent(
    provider,
    workspaceMod.WORKSPACE_TOOLS,
    [
      { role: "system" as const, content: workspaceInstructions(request.sources) },
      ...threadHistory(request.store, request.activeThread),
      { role: "user" as const, content: request.prompt },
    ],
    workspaceMod.workspaceToolCtx(request.sources)
  );
  return agentReply(
    request.store,
    result.content || "Done.",
    sourceCitationsForSteps(request.sources, result.steps)
  );
}

function workspaceInstructions(sources: AgentSource[]): string {
  const catalog = sources
    .slice(0, 48)
    .map((source) => `- ${source.title}: ${source.href}`)
    .join("\n");

  return [
    "You are Verto's grounded workspace assistant.",
    "For questions about the workspace, use search_workspace first and read_workspace_source for each source you rely on before answering.",
    "Use only tool results as evidence for workspace claims. If the sources do not answer the question, say so plainly instead of guessing.",
    "Never claim that you read, searched, or cited a source unless you used its tool URL in this conversation.",
    `There are ${sources.length} attached readable source${sources.length === 1 ? "" : "s"}:`,
    catalog,
  ].join("\n\n");
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

async function getAgentReply(request: AgentReplyRequest): Promise<ThreadMessage> {
  switch (request.kind) {
    case "mock":
      return mockReply(request);
    case "github":
      return githubReply(request);
  }
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
