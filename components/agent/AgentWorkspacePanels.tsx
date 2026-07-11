import type { RefObject } from "react";
import Link from "next/link";
import AgentEmptyState, { AgentEmptyCompact } from "@/components/agent/AgentEmptyState";
import { AgentMessage, AgentThinkingMessage } from "@/components/agent/AgentMessage";
import { ChevronRight, Plus, SendHorizontal, Sparkles, Trash2 } from "lucide-react";
import type { AgentThreadData, AgentThreadMessage } from "@/lib/agent-threads";

type AssistantKind = "none" | "mock" | "github";
type ThreadGroup = { group: string; items: AgentThreadData[] };

interface SourceLink {
  title: string;
  subtitle: string;
  href: string;
}

interface AgentHistoryProps {
  threads: AgentThreadData[];
  groups: ThreadGroup[];
  activeId: string | null;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AgentHistory({
  threads,
  groups,
  activeId,
  onNewChat,
  onSelect,
  onDelete,
}: AgentHistoryProps) {
  return (
    <aside className="ag-history" aria-label="Conversations">
      <div className="ag-history-head">
        <span>Conversations</span>
        <small>{threads.length}</small>
      </div>
      <button type="button" className="ag-new" onClick={onNewChat}>
        <Plus aria-hidden /> <span>New Chat</span>
      </button>

      {threads.length === 0 && <p className="ag-history-empty">No conversations yet.</p>}

      {groups.map(({ group, items }) => (
        <div key={group} className="ag-history-group">
          <p className="ag-history-label">{group}</p>
          {items.map((thread) => (
            <div key={thread.id} className="ag-history-row">
              <button
                type="button"
                className={`ag-history-item${thread.id === activeId ? " is-active" : ""}`}
                onClick={() => onSelect(thread.id)}
              >
                {thread.title}
              </button>
              <button
                type="button"
                className="ag-history-delete"
                aria-label={`Delete ${thread.title}`}
                onClick={() => onDelete(thread.id)}
              >
                <Trash2 aria-hidden size={14} />
              </button>
            </div>
          ))}
        </div>
      ))}
    </aside>
  );
}

interface AgentConversationProps {
  assistantKind: AssistantKind;
  sourceCount: number;
  activeId: string | null;
  activeTitle: string;
  providerName: string;
  messageCountLabel: string;
  messages: AgentThreadMessage[];
  sending: boolean;
  streamRef: RefObject<HTMLDivElement | null>;
  draftRef: RefObject<HTMLInputElement | null>;
  onPromptSelect: (prompt: string) => void;
  onSend: () => void;
}

export function AgentConversation({
  assistantKind,
  sourceCount,
  activeId,
  activeTitle,
  providerName,
  messageCountLabel,
  messages,
  sending,
  streamRef,
  draftRef,
  onPromptSelect,
  onSend,
}: AgentConversationProps) {
  return (
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
        {activeId && messages.length === 0 && (
          <AgentEmptyState
            assistantKind={assistantKind}
            disabled={!activeId || sending}
            onPromptSelect={onPromptSelect}
            sourcesCount={sourceCount}
          />
        )}

        {messages.map((message) => (
          <AgentMessage key={message.id} msg={message} />
        ))}

        {sending && <AgentThinkingMessage />}
      </div>

      <form
        className="ag-composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <input
          ref={draftRef}
          defaultValue=""
          placeholder="Ask anything about your knowledge…"
          aria-label="Message the agent"
          disabled={!activeId || sending}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <button type="submit" className="ag-send" aria-label="Send" disabled={!activeId || sending}>
          <SendHorizontal aria-hidden />
        </button>
      </form>
    </section>
  );
}

function countLabel(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

export function AgentContext({ sources }: { sources: SourceLink[] }) {
  return (
    <aside className="ag-context" aria-label="Context">
      <div className="ag-context-head">
        <h2 className="ag-context-title">Context</h2>
        <p className="ag-context-count">{countLabel(sources.length, "active source")}</p>
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
  );
}
