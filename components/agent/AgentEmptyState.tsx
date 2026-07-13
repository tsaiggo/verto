"use client";

import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  FileText,
  KeyRound,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

type SetupState = Pick<AgentEmptyStateProps, "assistantKind" | "providerReady" | "workspaceStatus">;

interface SetupContent {
  icon: LucideIcon;
  kicker: string;
  title: string;
  description: string;
  status: string;
  actionHref: string;
  actionLabel: string;
}

function setupContent({ assistantKind, providerReady, workspaceStatus }: SetupState): SetupContent {
  if (!providerReady) {
    const providerDisabled = assistantKind === "none";
    return providerDisabled
      ? {
          icon: Settings2,
          kicker: "AI setup needed",
          title: "AI is not enabled in this version of Verto",
          description:
            "Agent stays paused until an AI provider is included. Your Library, Reader, and Collections remain available without it.",
          status: "AI setup needed",
          actionHref: "/settings/agent",
          actionLabel: "Open AI & Agent settings",
        }
      : {
          icon: KeyRound,
          kicker: "Assistant key required",
          title: "Add an assistant key to start a conversation",
          description:
            "A provider is enabled, but this device does not have an assistant access key yet. Add one in Settings before Agent sends a request.",
          status: "Access key missing",
          actionHref: "/settings/agent",
          actionLabel: "Open AI & Agent settings",
        };
  }

  if (workspaceStatus === "loading") {
    return {
      icon: FileText,
      kicker: "Indexing source",
      title: "Loading your local library",
      description:
        "Agent will become available after Verto finishes indexing the selected local folder.",
      status: "Source indexing",
      actionHref: "/integrations",
      actionLabel: "Manage sources",
    };
  }

  if (workspaceStatus === "error") {
    return {
      icon: FileText,
      kicker: "Source unavailable",
      title: "Fix the connected local library",
      description:
        "Verto could not read the selected local folder. Reconnect it or choose another folder before starting a grounded conversation.",
      status: "Source unavailable",
      actionHref: "/integrations",
      actionLabel: "Manage sources",
    };
  }

  return {
    icon: FileText,
    kicker: "Readable source required",
    title: "Connect a readable source to use Agent",
    description:
      "Connect a Markdown or MDX folder with at least one readable document. Agent only starts when it has source material to inspect.",
    status: "No readable files",
    actionHref: "/integrations",
    actionLabel: "Manage sources",
  };
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
    const setup = setupContent({ assistantKind, providerReady, workspaceStatus });
    const SetupIcon = setup.icon;

    return (
      <div className="ag-empty ag-empty--setup">
        <div className="ag-empty-kicker ag-empty-kicker--setup">
          <SetupIcon aria-hidden />
          {setup.kicker}
        </div>
        <h1>{setup.title}</h1>
        <p>{setup.description}</p>
        <div className="ag-empty-meta" aria-label="Agent setup status">
          <span>
            <strong>{sourcesCount}</strong> active {sourcesCount === 1 ? "source" : "sources"}
          </span>
          <span>{setup.status}</span>
        </div>
        <div className="ag-setup-actions">
          <Link href={setup.actionHref} className="v-btn v-btn--primary ag-setup-action">
            {setup.actionLabel}
            <ChevronRight aria-hidden />
          </Link>
          {!providerReady ? (
            <Link href="/library" className="v-btn v-btn--ghost ag-setup-secondary">
              <BookOpen aria-hidden />
              Browse your library
            </Link>
          ) : null}
        </div>
        {!providerReady ? (
          <p className="ag-setup-note">
            You can keep reading, organizing, and editing your workspace while AI is unavailable.
          </p>
        ) : null}
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
