"use client";

import { useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Files,
  Maximize2,
  Minimize2,
  PanelRightClose,
  Plus,
  Trash2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import AgentEmptyState, { AgentEmptyCompact } from "@/components/agent/AgentEmptyState";
import {
  AgentMessage,
  AgentRecoveryMessage,
  AgentThinkingMessage,
} from "@/components/agent/AgentMessage";
import type { AgentThreadData, AgentThreadMessage, AgentThreadScope } from "@/lib/agent-threads";
import type { AgentConversationFailure } from "@/components/agent/useAgentConversation";
import AgentComposer from "./AgentComposer";
import styles from "./AgentWorkspace.module.css";

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
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AgentHistory({ threads, groups, activeId, onSelect, onDelete }: AgentHistoryProps) {
  return (
    <div className={styles.history} data-agent-history>
      <div className={styles.popoverHeading}>
        <h2>Conversations</h2>
        <span>{threads.length}</span>
      </div>
      {threads.length === 0 && <p className={styles.contextNote}>No conversations yet.</p>}
      <div className={styles.historyList}>
        {groups.map(({ group, items }) => (
          <div key={group} className={styles.historyGroup}>
            <p className={styles.groupLabel}>{group}</p>
            {items.map((thread) => (
              <div key={thread.id} className={styles.historyRow}>
                <button
                  type="button"
                  className={styles.historyItem}
                  data-active={thread.id === activeId || undefined}
                  onClick={() => onSelect(thread.id)}
                  aria-label={thread.title}
                  aria-current={thread.id === activeId ? "true" : undefined}
                  aria-describedby={`agent-thread-scope-${thread.id}`}
                >
                  <span className={styles.historyTitle}>{thread.title}</span>
                  <span
                    id={`agent-thread-scope-${thread.id}`}
                    className={styles.historyScope}
                    data-agent-history-scope
                  >
                    {thread.scope?.kind === "document"
                      ? `Page · ${thread.scope.title}`
                      : "Workspace"}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.deleteButton}
                  aria-label={`Delete ${thread.title}`}
                  onClick={() => onDelete(thread.id)}
                >
                  <Trash2 aria-hidden size={14} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

interface AgentHeaderProps extends AgentHistoryProps {
  activeTitle: string;
  variant: "page" | "pane";
  contextOpen: boolean;
  onContextOpenChange: (open: boolean) => void;
  context: ReactNode;
  onNewChat: () => void;
  onCollapse?: () => void;
}

export function AgentHeader({
  activeTitle,
  variant,
  contextOpen,
  onContextOpenChange,
  context,
  onNewChat,
  onCollapse,
  onSelect,
  ...historyProps
}: AgentHeaderProps) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <header className={styles.header}>
      <h1 className={styles.srOnly}>Agent</h1>
      <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={styles.conversationSwitcher}
            aria-label="Conversation history"
            title="Switch conversation"
          >
            <span data-agent-conversation-title>{activeTitle}</span>
            <ChevronDown aria-hidden size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent className={styles.popover} align="start" aria-label="Conversation history">
          <AgentHistory
            {...historyProps}
            onSelect={(id) => {
              onSelect(id);
              setHistoryOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      <div className={styles.headerActions}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="New Chat"
          title="New Chat"
          onClick={() => {
            onNewChat();
            setHistoryOpen(false);
          }}
        >
          <Plus aria-hidden size={16} />
        </button>
        <Popover open={contextOpen} onOpenChange={onContextOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="View Agent context"
              title="View Agent context"
            >
              <Files aria-hidden size={16} />
            </button>
          </PopoverTrigger>
          <PopoverContent className={styles.popover} align="end" aria-label="Agent context">
            {context}
          </PopoverContent>
        </Popover>
        {variant === "pane" ? (
          <>
            <Link
              href="/agent"
              className={styles.iconButton}
              aria-label="Expand Agent workspace"
              title="Expand Agent workspace"
            >
              <Maximize2 aria-hidden size={16} />
            </Link>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Collapse Agent pane"
              title="Collapse Agent pane"
              onClick={onCollapse}
            >
              <PanelRightClose aria-hidden size={16} />
            </button>
          </>
        ) : (
          <Link
            href="/"
            className={styles.iconButton}
            aria-label="Return to Home"
            title="Return to Home"
          >
            <Minimize2 aria-hidden size={16} />
          </Link>
        )}
      </div>
    </header>
  );
}

interface AgentConversationProps {
  assistantKind: AssistantKind;
  isReady: boolean;
  providerReady: boolean;
  isGrounded: boolean;
  workspaceStatus: "ready" | "loading" | "error";
  sourceCount: number;
  activeId: string | null;
  activeScope?: AgentThreadScope;
  contextOpen: boolean;
  messages: AgentThreadMessage[];
  sending: boolean;
  failure: AgentConversationFailure | null;
  streamRef: RefObject<HTMLDivElement | null>;
  draftRef: RefObject<HTMLTextAreaElement | null>;
  onContextToggle: () => void;
  onSend: () => void;
  onStop: () => void;
  onRestorePrompt: () => void;
  onRetry: () => void;
}

export function AgentConversation({
  assistantKind,
  isReady,
  providerReady,
  isGrounded,
  workspaceStatus,
  sourceCount,
  activeId,
  activeScope,
  contextOpen,
  messages,
  sending,
  failure,
  streamRef,
  draftRef,
  onContextToggle,
  onSend,
  onStop,
  onRestorePrompt,
  onRetry,
}: AgentConversationProps) {
  return (
    <section className={styles.conversation} aria-label="Conversation">
      <div className={styles.stream} ref={streamRef} data-agent-stream>
        <div className={styles.streamInner}>
          {!activeId && <AgentEmptyCompact />}
          {activeId && messages.length === 0 && !failure && !sending && (
            <AgentEmptyState
              assistantKind={assistantKind}
              isReady={isReady}
              providerReady={providerReady}
              isGrounded={isGrounded}
              workspaceStatus={workspaceStatus}
            />
          )}
          {messages.map((message) => (
            <AgentMessage key={message.id} msg={message} />
          ))}
          {failure && (
            <AgentRecoveryMessage
              message={failure.message}
              onRestorePrompt={onRestorePrompt}
              onRetry={onRetry}
            />
          )}
          {sending && <AgentThinkingMessage />}
        </div>
      </div>
      <AgentComposer
        assistantKind={assistantKind}
        isReady={isReady}
        providerReady={providerReady}
        workspaceStatus={workspaceStatus}
        activeId={activeId}
        activeScope={activeScope}
        sourceCount={sourceCount}
        contextOpen={contextOpen}
        sending={sending}
        draftRef={draftRef}
        onContextToggle={onContextToggle}
        onSend={onSend}
        onStop={onStop}
      />
    </section>
  );
}

function countLabel(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

export function AgentContext({
  sources,
  sourceCount,
  availableSourceCount,
  isReady,
  isGrounded,
  status,
  detail,
}: {
  sources: SourceLink[];
  sourceCount: number;
  availableSourceCount: number;
  isReady: boolean;
  isGrounded: boolean;
  status: "ready" | "loading" | "error";
  detail: string | null;
}) {
  const sourceStatus =
    status === "loading"
      ? "Loading local library…"
      : status === "error"
        ? "Local library needs attention."
        : null;
  const unattachedCount = Math.max(0, availableSourceCount - sourceCount);

  return (
    <div className={styles.context} data-agent-context>
      <div className={styles.popoverHeading}>
        <h2>Source context</h2>
        <span>{countLabel(sourceCount, "source")}</span>
      </div>
      <div className={styles.sourceList}>
        {sourceStatus ? (
          <div className={styles.sourceEmpty}>
            <p>{sourceStatus}</p>
            {detail ? <small>{detail}</small> : null}
            {status === "error" ? <Link href="/integrations">Manage sources</Link> : null}
          </div>
        ) : sources.length > 0 ? (
          sources.map((source) => (
            <Link key={source.href} href={source.href} className={styles.source}>
              <span className={styles.sourceText}>
                <strong>{source.title}</strong>
                <small>{source.subtitle}</small>
              </span>
              <ChevronRight aria-hidden size={14} />
            </Link>
          ))
        ) : (
          <div className={styles.sourceEmpty}>
            <p>No readable sources are connected.</p>
            <Link href="/integrations">Connect a source</Link>
          </div>
        )}
      </div>
      <p className={styles.contextNote}>
        {isGrounded
          ? `Citations appear for sources the Agent opens.${sourceCount > sources.length ? ` Showing ${sources.length} of ${sourceCount} attached sources.` : ""}${unattachedCount > 0 ? ` ${countLabel(unattachedCount, "other library document")} cannot be searched or cited.` : ""}`
          : isReady
            ? "Demo responses are deterministic and do not use a live model."
            : "These sources become available to Agent when an AI provider is ready."}
      </p>
    </div>
  );
}
