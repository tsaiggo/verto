"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import AgentEmptyState, { AgentEmptyCompact } from "@/components/agent/AgentEmptyState";
import { AgentMessage, AgentThinkingMessage } from "@/components/agent/AgentMessage";
import { ChevronRight, Loader2, Plus, SendHorizontal, Sparkles, Trash2 } from "lucide-react";

// ── Shared types (consumed by the page) ─────────────────────────────

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
}

// ── Props ───────────────────────────────────────────────────────────

interface AgentWorkspaceProps {
  sources: AgentSource[];
  assistantKind: "none" | "mock" | "github";
}

// ── No-op helpers when the store isn't loaded yet ────────────────────

/** Lazy store — set after the dynamic import in useInitStore. */
let _store: typeof import("@/lib/agent-threads") | null = null;

type ThreadData = import("@/lib/agent-threads").AgentThreadData;
type ThreadMessage = import("@/lib/agent-threads").AgentThreadMessage;

function providerLabel(kind: AgentWorkspaceProps["assistantKind"]): string {
  switch (kind) {
    case "none":
      return "Not connected";
    case "mock":
      return "Mock provider";
    case "github":
      return "GitHub Models";
  }
}

function countLabel(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

// ── Component ───────────────────────────────────────────────────────

/**
 * Agent workspace with persisted threads and a real agent loop.
 *
 * Three panes:
 *   left   — conversation history (thread list)
 *   center — the active conversation with a composer
 *   right  — context rail (sources the agent can reference)
 */
export default function AgentWorkspace({ sources, assistantKind }: AgentWorkspaceProps) {
  const streamRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLInputElement>(null);
  const [initDone, setInitDone] = useState(false);

  // ── Thread state (persisted) ────────────────────────────────────

  const [threads, setThreads] = useState<ThreadData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Derive the active thread from the persisted list.
  const activeThread: ThreadData | null = useMemo(
    () => threads.find((t) => t.id === activeId) ?? null,
    [threads, activeId]
  );

  // ── Messages for the active thread (lifted to local state for ────
  //     optimistic UI updates while the agent runs) ─────────────────

  const [localMessages, setLocalMessages] = useState<ThreadMessage[]>([]);

  // ── Agent state ──────────────────────────────────────────────────

  const [sending, setSending] = useState(false);
  const visibleMessageCount = localMessages.filter((message) => message.role !== "tool").length;
  const providerName = providerLabel(assistantKind);
  const messageCountLabel = countLabel(visibleMessageCount, "message");
  const sourceCountLabel = countLabel(sources.length, "active source");
  const activeTitle = activeThread?.title ?? "New Chat";

  // ── Helpers that reload the thread list from the store ───────────

  function reloadThreads() {
    if (!_store) return;
    setThreads(_store.loadThreads());
  }

  // ── Initialize store on mount ─────────────────────────────────────

  // This runs once on mount (client-only). We use a module-level `_store`
  // variable so all component instances share the same lazy reference.
  useMemo(() => {
    if (_store) return;
    // Dynamic import so this module can be SSR-safe.
    import("@/lib/agent-threads").then((mod) => {
      _store = mod;
      const existing = mod.loadThreads();
      if (existing.length > 0) {
        setThreads(existing);
        setActiveId(existing[0].id);
      } else {
        const fresh = mod.createThread(undefined);
        setThreads([fresh]);
        setActiveId(fresh.id);
      }
      setInitDone(true);
    });
  }, []);

  // Sync local messages when the active thread changes.
  useMemo(() => {
    if (activeThread) {
      setLocalMessages(activeThread.messages);
    } else {
      setLocalMessages([]);
    }
  }, [activeThread?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Thread grouping ──────────────────────────────────────────────

  const grouped = useMemo(() => {
    const groupFn = _store?.threadGroup ?? (() => "Today");
    const order: string[] = [];
    const map = new Map<string, ThreadData[]>();
    for (const thread of threads) {
      const g = groupFn(thread.updatedAt);
      if (!map.has(g)) {
        map.set(g, []);
        order.push(g);
      }
      map.get(g)!.push(thread);
    }
    return order.map((group) => ({ group, items: map.get(group)! }));
  }, [threads]);

  // ── New Chat ─────────────────────────────────────────────────────

  function handleNewChat() {
    if (!_store) return;
    const thread = _store.createThread(undefined);
    setActiveId(thread.id);
    setLocalMessages([]);
    reloadThreads();
    draftRef.current?.focus();
    scrollDown();
  }

  // ── Delete thread ────────────────────────────────────────────────

  function handleDelete(id: string) {
    if (!_store) return;
    _store.deleteThread(id);
    if (id === activeId) {
      const remaining = _store.loadThreads();
      if (remaining.length > 0) {
        setActiveId(remaining[0].id);
      } else {
        const fresh = _store.createThread(undefined);
        setActiveId(fresh.id);
      }
    }
    reloadThreads();
  }

  // ── Send / agent loop ────────────────────────────────────────────

  async function handleSend() {
    if (!_store || !activeId) return;
    const value = draftRef.current?.value?.trim();
    if (!value || sending) return;

    const userMsg: ThreadMessage = { id: _store.newId(), role: "user", text: value };

    // Optimistic update.
    setLocalMessages((prev) => [...prev, userMsg]);
    _store.addMessage(activeId, userMsg);
    setSending(true);
    if (draftRef.current) draftRef.current.value = "";
    scrollDown();

    try {
      if (assistantKind === "none") {
        // Not configured — explain how to enable.
        await new Promise((r) => setTimeout(r, 400));
        const reply: ThreadMessage = {
          id: _store.newId(),
          role: "agent",
          text: "The AI assistant is not configured. Set NEXT_PUBLIC_VERTO_ASSISTANT=mock (dev) or connect a GitHub Models token to get real answers.",
        };
        setLocalMessages((prev) => [...prev, reply]);
        _store.addMessage(activeId, reply);
      } else if (assistantKind === "mock") {
        // Mock provider for development.
        const mockMod = await import("@/lib/ai/mock");
        const agentMod = await import("@/lib/ai/agent");
        const libMod = await import("@/lib/ai/tools/library");
        const provider = mockMod.createMockProvider();
        const history = activeThread ? activeThread.messages.map(_store.toChatMessage) : [];
        const ctx = libMod.readingToolCtx(null);
        const result = await agentMod.runAgent(
          provider,
          libMod.READING_TOOLS,
          [...history, { role: "user" as const, content: value }],
          ctx
        );
        const reply: ThreadMessage = {
          id: _store.newId(),
          role: "agent",
          text: result.content || "Done.",
          citations: sources.slice(0, 3).map((s, i) => ({
            index: i + 1,
            label: s.title,
            href: s.href,
          })),
        };
        setLocalMessages((prev) => [...prev, reply]);
        _store.addMessage(activeId, reply);
      } else {
        // GitHub Models provider — try loading the token.
        const [keyStore, agentMod, indexMod, libMod] = await Promise.all([
          import("@/lib/ai/key-store"),
          import("@/lib/ai/agent"),
          import("@/lib/ai/index"),
          import("@/lib/ai/tools/library"),
        ]);
        const token = keyStore.loadWebKey();
        if (!token) {
          const reply: ThreadMessage = {
            id: _store.newId(),
            role: "agent",
            text: "To use GitHub Models, paste a GitHub token on the Settings page.",
          };
          setLocalMessages((prev) => [...prev, reply]);
          _store.addMessage(activeId, reply);
        } else {
          const hasTauri =
            typeof window !== "undefined" &&
            typeof (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !==
              "undefined";
          const provider = indexMod.createAssistantProvider({
            kind: "github",
            token,
            fetchImpl: hasTauri
              ? async (url: RequestInfo | URL, init?: RequestInit) => {
                  const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
                  return tauriFetch(url.toString(), init as Record<string, unknown>);
                }
              : window.fetch.bind(window),
          });
          const history = activeThread ? activeThread.messages.map(_store.toChatMessage) : [];
          const ctx = libMod.readingToolCtx(null);
          const result = await agentMod.runAgent(
            provider,
            libMod.READING_TOOLS,
            [...history, { role: "user" as const, content: value }],
            ctx
          );
          const reply: ThreadMessage = {
            id: _store.newId(),
            role: "agent",
            text: result.content || "Done.",
            citations: sources.slice(0, 3).map((s, i) => ({
              index: i + 1,
              label: s.title,
              href: s.href,
            })),
          };
          setLocalMessages((prev) => [...prev, reply]);
          _store.addMessage(activeId, reply);
        }
      }
    } catch (err) {
      console.error("Agent chat error:", err);
      const errorMsg: ThreadMessage = {
        id: _store.newId(),
        role: "agent",
        text: "Sorry, something went wrong while processing your request.",
      };
      setLocalMessages((prev) => [...prev, errorMsg]);
      if (_store) _store.addMessage(activeId, errorMsg);
    } finally {
      setSending(false);
      scrollDown();
    }
  }

  // ── Scroll helper ────────────────────────────────────────────────

  function scrollDown() {
    requestAnimationFrame(() => {
      streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  function fillStarterPrompt(prompt: string) {
    if (!activeId || sending || !draftRef.current) return;
    draftRef.current.value = prompt;
    draftRef.current.focus();
  }

  // ── Render ───────────────────────────────────────────────────────

  if (!initDone) {
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
      {/* ── Left rail: thread history ───────────────────────────── */}
      <aside className="ag-history" aria-label="Conversations">
        <div className="ag-history-head">
          <span>Conversations</span>
          <small>{threads.length}</small>
        </div>
        <button type="button" className="ag-new" onClick={handleNewChat}>
          <Plus aria-hidden /> <span>New Chat</span>
        </button>

        {threads.length === 0 && <p className="ag-history-empty">No conversations yet.</p>}

        {grouped.map(({ group, items }) => (
          <div key={group} className="ag-history-group">
            <p className="ag-history-label">{group}</p>
            {items.map((thread) => (
              <div key={thread.id} className="ag-history-row">
                <button
                  type="button"
                  className={`ag-history-item${thread.id === activeId ? " is-active" : ""}`}
                  onClick={() => {
                    setActiveId(thread.id);
                    scrollDown();
                  }}
                >
                  {thread.title}
                </button>
                <button
                  type="button"
                  className="ag-history-delete"
                  aria-label={`Delete ${thread.title}`}
                  onClick={() => handleDelete(thread.id)}
                >
                  <Trash2 aria-hidden size={14} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </aside>

      {/* ── Center: conversation stream + composer ──────────────── */}
      <section className="ag-stream-wrap" aria-label="Conversation">
        <div className="ag-session-head">
          <div className="ag-session-title">
            <span>Session</span>
            <strong>{activeTitle}</strong>
          </div>
          <div className="ag-session-meta" aria-label="Conversation status">
            <span>{providerName}</span>
            <span>{messageCountLabel}</span>
          </div>
        </div>
        <div className="ag-stream" ref={streamRef}>
          {!activeId && <AgentEmptyCompact />}
          {activeId && localMessages.length === 0 && (
            <AgentEmptyState
              assistantKind={assistantKind}
              disabled={!activeId || sending}
              onPromptSelect={fillStarterPrompt}
              sourcesCount={sources.length}
            />
          )}

          {localMessages.map((msg) => (
            <AgentMessage key={msg.id} msg={msg} />
          ))}

          {sending && <AgentThinkingMessage />}
        </div>

        <form
          className="ag-composer"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            ref={draftRef}
            defaultValue=""
            placeholder="Ask anything about your knowledge…"
            aria-label="Message the agent"
            disabled={!activeId || sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            type="submit"
            className="ag-send"
            aria-label="Send"
            disabled={!activeId || sending}
          >
            <SendHorizontal aria-hidden />
          </button>
        </form>
      </section>

      {/* ── Right rail: context sources ─────────────────────────── */}
      <aside className="ag-context" aria-label="Context">
        <div className="ag-context-head">
          <h2 className="ag-context-title">Context</h2>
          <p className="ag-context-count">{sourceCountLabel}</p>
        </div>
        <div className="ag-source-list">
          {sources.map((source) => (
            <Link key={source.title} href={source.href} className="ag-source">
              <span className="ag-source-text">
                <strong>{source.title}</strong>
                <small>{source.subtitle}</small>
              </span>
              <ChevronRight aria-hidden className="ag-source-chevron" />
            </Link>
          ))}
        </div>
        <div className="ag-grounding">
          <p className="ag-grounding-title">
            <Sparkles aria-hidden /> Grounding
          </p>
          <p className="ag-grounding-text">All responses are grounded in your sources.</p>
          <span className="ag-grounding-bar" aria-hidden />
        </div>
      </aside>
    </div>
  );
}
