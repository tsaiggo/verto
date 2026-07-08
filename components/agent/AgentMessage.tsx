"use client";

import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AgentThreadMessage } from "@/lib/agent-threads";

function AgentMarkdown({ text }: { text: string }) {
  return (
    <div className="ag-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

export function AgentMessage({ msg }: { msg: AgentThreadMessage }) {
  if (msg.role === "user") {
    return (
      <div className="ag-msg ag-msg--user">
        <div className="ag-msg-stack ag-msg-stack--user">
          <span className="ag-message-label">You</span>
          <div className="ag-bubble ag-bubble--user">{msg.text}</div>
        </div>
      </div>
    );
  }

  if (msg.role === "tool") return null;

  return (
    <div className="ag-msg ag-msg--agent">
      <div className="ag-msg-stack ag-msg-stack--agent">
        <span className="ag-message-label ag-message-label--agent">
          <Sparkles aria-hidden />
          Agent
        </span>
        <div className="ag-bubble ag-bubble--agent">
          {msg.text ? <AgentMarkdown text={msg.text} /> : null}
          {msg.list ? (
            <ol className="ag-list">
              {msg.list.map((item) => (
                <li key={item.term}>
                  <strong>{item.term}.</strong> {item.text}
                </li>
              ))}
            </ol>
          ) : null}
          {msg.citations?.length ? (
            <div className="ag-cites">
              {msg.citations.map((cite) => (
                <Link key={cite.index} href={cite.href} className="ag-cite">
                  <span className="ag-cite-num">{cite.index}</span>
                  {cite.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function AgentThinkingMessage() {
  return (
    <div className="ag-msg ag-msg--agent">
      <div className="ag-msg-stack ag-msg-stack--agent">
        <span className="ag-message-label ag-message-label--agent">
          <Sparkles aria-hidden />
          Agent
        </span>
        <div className="ag-bubble ag-bubble--agent ag-bubble--thinking">
          <Loader2 aria-hidden className="ag-spinner" size={18} />
          <span>Thinking...</span>
        </div>
      </div>
    </div>
  );
}
