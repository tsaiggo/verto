"use client";

import Link from "next/link";
import { ChevronRight, FileText, KeyRound, Search, Settings2, Sparkles } from "lucide-react";

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
  isReady: boolean;
  providerReady: boolean;
  isGrounded: boolean;
  workspaceStatus: "ready" | "loading" | "error";
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
  isReady,
  providerReady,
  isGrounded,
  workspaceStatus,
  disabled,
  onPromptSelect,
  sourcesCount,
}: AgentEmptyStateProps) {
  if (!isReady) {
    const providerDisabled = assistantKind === "none";
    const needsProvider = !providerReady;
    const waitingForLibrary = workspaceStatus === "loading";
    const libraryError = workspaceStatus === "error";
    const SetupIcon = needsProvider ? (providerDisabled ? Settings2 : KeyRound) : FileText;
    const title = needsProvider
      ? providerDisabled
        ? "Connect an AI provider to use Agent"
        : "Add an assistant key to start a conversation"
      : waitingForLibrary
        ? "Loading your local library"
        : libraryError
          ? "Fix the connected local library"
          : "Connect a readable source to use Agent";
    const description = needsProvider
      ? providerDisabled
        ? "This build has no AI provider enabled, so Agent will not send or save a request. Enable a supported provider, then add its access key in Settings."
        : "A provider is enabled, but this device does not have an assistant access key yet. Add one in Settings before Agent sends a request."
      : waitingForLibrary
        ? "Agent will become available after Verto finishes indexing the selected local folder."
        : libraryError
          ? "Verto could not read the selected local folder. Reconnect it or choose another folder before starting a grounded conversation."
          : "Connect a Markdown or MDX folder with at least one readable document. Agent only starts when it has source material to inspect.";
    const actionHref = needsProvider ? "/settings/agent" : "/integrations";
    const actionLabel = needsProvider ? "Open AI & Agent settings" : "Manage sources";

    return (
      <div className="ag-empty ag-empty--setup">
        <div className="ag-empty-kicker ag-empty-kicker--setup">
          <SetupIcon aria-hidden />
          {needsProvider
            ? providerDisabled
              ? "AI provider required"
              : "Assistant key required"
            : waitingForLibrary
              ? "Indexing source"
              : libraryError
                ? "Source unavailable"
                : "Readable source required"}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="ag-empty-meta" aria-label="Agent setup status">
          <span>
            <strong>{sourcesCount}</strong> active {sourcesCount === 1 ? "source" : "sources"}
          </span>
          <span>
            {needsProvider
              ? providerDisabled
                ? "Provider disabled"
                : "Access key missing"
              : waitingForLibrary
                ? "Source indexing"
                : libraryError
                  ? "Source unavailable"
                  : "No readable files"}
          </span>
        </div>
        <Link href={actionHref} className="v-btn v-btn--primary ag-setup-action">
          {actionLabel}
          <ChevronRight aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="ag-empty">
      <div className="ag-empty-kicker">
        <Sparkles aria-hidden /> {isGrounded ? "Agent ready" : "Agent demo ready"}
      </div>
      <h1>{isGrounded ? "Ask across your knowledge sources" : "Try the Agent demo"}</h1>
      <p>
        {isGrounded
          ? "Start with a focused request. The agent can summarize, search, and draft from the sources attached to this workspace."
          : "This build uses deterministic demo responses. Configure a supported provider for answers that search and read your sources."}
      </p>
      <div className="ag-empty-meta" aria-label="Agent context summary">
        <span>
          <strong>{sourcesCount}</strong> active sources
        </span>
        <span>{isGrounded ? "Source-backed answers" : "Demo responses"}</span>
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
