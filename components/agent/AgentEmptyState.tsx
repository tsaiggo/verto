"use client";

import { ChevronRight, FileText, Search, Sparkles } from "lucide-react";

const STARTER_PROMPTS = [
  {
    label: "Summarize a source",
    detail: "Pull the main points from your active knowledge base.",
    prompt: "Summarize the most important ideas in my active sources.",
    icon: FileText,
  },
  {
    label: "Find an answer",
    detail: "Ask a pointed question and keep the answer cited.",
    prompt: "Find the answer to a question using my sources and include citations.",
    icon: Search,
  },
  {
    label: "Draft from context",
    detail: "Turn source material into a usable outline or first draft.",
    prompt: "Draft an outline from my sources for the topic I am working on.",
    icon: Sparkles,
  },
] as const;

interface AgentEmptyStateProps {
  assistantKind: "none" | "mock" | "github";
  disabled: boolean;
  onPromptSelect: (prompt: string) => void;
  sourcesCount: number;
}

export function AgentEmptyCompact() {
  return (
    <div className="ag-empty ag-empty--compact">
      <p>Select a conversation or start a new chat.</p>
    </div>
  );
}

export default function AgentEmptyState({
  assistantKind,
  disabled,
  onPromptSelect,
  sourcesCount,
}: AgentEmptyStateProps) {
  return (
    <div className="ag-empty">
      <div className="ag-empty-kicker">
        <Sparkles aria-hidden /> Agent ready
      </div>
      <h1>Ask across your knowledge sources</h1>
      <p>
        Start with a focused request. The agent can summarize, search, and draft from the sources
        attached to this workspace.
      </p>
      <div className="ag-empty-meta" aria-label="Agent context summary">
        <span>
          <strong>{sourcesCount}</strong> active sources
        </span>
        <span>{assistantKind === "none" ? "Provider not connected" : "Grounded answers"}</span>
      </div>
      <div className="ag-starters">
        {STARTER_PROMPTS.map(({ label, detail, prompt, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className="ag-starter"
            onClick={() => onPromptSelect(prompt)}
            disabled={disabled}
          >
            <span className="ag-starter-icon">
              <Icon aria-hidden />
            </span>
            <span className="ag-starter-text">
              <strong>{label}</strong>
              <small>{detail}</small>
            </span>
            <ChevronRight aria-hidden className="ag-starter-arrow" />
          </button>
        ))}
      </div>
    </div>
  );
}
