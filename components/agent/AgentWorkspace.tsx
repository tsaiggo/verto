"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, SendHorizontal, Sparkles } from "lucide-react";

export interface AgentThread {
  id: string;
  title: string;
  group: string;
}

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

interface AgentWorkspaceProps {
  threads: AgentThread[];
  activeThreadId: string;
  messages: AgentMessage[];
  sources: AgentSource[];
}

let replyCounter = 0;

/**
 * Functional agent workspace (mockup 05 — Agent · Chat, contextual). Three
 * panes: conversation history, the grounded conversation with a composer, and
 * the live Context rail listing the sources every answer is grounded in.
 */
export default function AgentWorkspace({
  threads,
  activeThreadId,
  messages: seeded,
  sources,
}: AgentWorkspaceProps) {
  const [active, setActive] = useState(activeThreadId);
  const [messages, setMessages] = useState<AgentMessage[]>(seeded);
  const [draft, setDraft] = useState("");
  const streamRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, AgentThread[]>();
    for (const thread of threads) {
      if (!map.has(thread.group)) {
        map.set(thread.group, []);
        order.push(thread.group);
      }
      map.get(thread.group)!.push(thread);
    }
    return order.map((group) => ({ group, items: map.get(group)! }));
  }, [threads]);

  function send() {
    const value = draft.trim();
    if (!value) return;
    replyCounter += 1;
    const userMessage: AgentMessage = {
      id: `u-${replyCounter}`,
      role: "user",
      text: value,
    };
    const reply: AgentMessage = {
      id: `a-${replyCounter}`,
      role: "agent",
      text: "Grounding your question against the active sources in the Context panel. Every claim below cites a document in your library.",
      citations: sources.slice(0, 2).map((source, i) => ({
        index: i + 1,
        label: source.title,
        href: source.href,
      })),
    };
    setMessages((prev) => [...prev, userMessage, reply]);
    setDraft("");
    requestAnimationFrame(() => {
      streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: "smooth" });
    });
  }

  return (
    <div className="ag-workspace">
      <aside className="ag-history" aria-label="Conversations">
        <button type="button" className="ag-new">
          <Plus aria-hidden /> New Chat
        </button>
        {grouped.map(({ group, items }) => (
          <div key={group} className="ag-history-group">
            <p className="ag-history-label">{group}</p>
            {items.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={`ag-history-item${thread.id === active ? " is-active" : ""}`}
                onClick={() => setActive(thread.id)}
              >
                {thread.title}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <section className="ag-stream-wrap" aria-label="Conversation">
        <div className="ag-stream" ref={streamRef}>
          {messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="ag-msg ag-msg--user">
                <div className="ag-bubble ag-bubble--user">{message.text}</div>
              </div>
            ) : (
              <div key={message.id} className="ag-msg ag-msg--agent">
                <div className="ag-bubble ag-bubble--agent">
                  <p className="ag-lede">{message.text}</p>
                  {message.list ? (
                    <ol className="ag-list">
                      {message.list.map((item) => (
                        <li key={item.term}>
                          <strong>{item.term}.</strong> {item.text}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                  {message.citations?.length ? (
                    <div className="ag-cites">
                      {message.citations.map((cite) => (
                        <Link key={cite.index} href={cite.href} className="ag-cite">
                          <span className="ag-cite-num">{cite.index}</span>
                          {cite.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          )}
        </div>

        <form
          className="ag-composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask anything about your knowledge…"
            aria-label="Message the agent"
          />
          <button type="submit" className="ag-send" aria-label="Send" disabled={!draft.trim()}>
            <SendHorizontal aria-hidden />
          </button>
        </form>
      </section>

      <aside className="ag-context" aria-label="Context">
        <h2 className="ag-context-title">Context</h2>
        <p className="ag-context-count">Active sources ({sources.length})</p>
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
