"use client";

import { useEffect, useRef, type RefObject } from "react";
import Link from "next/link";
import { SendHorizontal, Square } from "lucide-react";
import type { AgentThreadScope } from "@/lib/agent-threads";
import styles from "./AgentWorkspace.module.css";

interface AgentComposerProps {
  assistantKind: "none" | "mock" | "github";
  isReady: boolean;
  providerReady: boolean;
  workspaceStatus: "ready" | "loading" | "error";
  activeId: string | null;
  activeScope?: AgentThreadScope;
  sourceCount: number;
  contextOpen: boolean;
  sending: boolean;
  draftRef: RefObject<HTMLTextAreaElement | null>;
  onContextToggle: () => void;
  onSend: () => void;
  onStop: () => void;
}

export default function AgentComposer({
  assistantKind,
  isReady,
  providerReady,
  workspaceStatus,
  activeId,
  activeScope,
  sourceCount,
  contextOpen,
  sending,
  draftRef,
  onContextToggle,
  onSend,
  onStop,
}: AgentComposerProps) {
  const composingRef = useRef(false);
  const composerDisabled = !activeId || sending || !isReady;
  const composerPlaceholder = isReady
    ? "Ask about your sources…"
    : !providerReady
      ? "AI is unavailable"
      : workspaceStatus === "loading"
        ? "Loading your local library…"
        : workspaceStatus === "error"
          ? "Reconnect your source to start"
          : "Connect a readable source to start";

  useEffect(() => {
    const textarea = draftRef.current;
    if (!textarea || typeof ResizeObserver === "undefined") return;
    let previousWidth = textarea.clientWidth;
    const observer = new ResizeObserver(() => {
      if (previousWidth === textarea.clientWidth) return;
      previousWidth = textarea.clientWidth;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [draftRef]);

  return (
    <div className={styles.composerArea}>
      <form
        className={styles.composer}
        data-disabled={composerDisabled || undefined}
        onSubmit={(event) => {
          event.preventDefault();
          if (!composingRef.current && !composerDisabled) onSend();
        }}
      >
        <textarea
          ref={draftRef}
          defaultValue=""
          rows={2}
          placeholder={composerPlaceholder}
          aria-label="Message the agent"
          aria-describedby="agent-composer-hint"
          disabled={composerDisabled}
          onInput={(event) => {
            const textarea = event.currentTarget;
            textarea.style.height = "auto";
            textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
          }}
          onCompositionStart={() => {
            composingRef.current = true;
          }}
          onCompositionEnd={() => {
            composingRef.current = false;
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              !composingRef.current &&
              event.keyCode !== 229
            ) {
              event.preventDefault();
              if (!composerDisabled) onSend();
            }
          }}
        />
        <div className={styles.composerFooter}>
          <AgentSourceContext
            activeScope={activeScope}
            sourceCount={sourceCount}
            assistantKind={assistantKind}
            contextOpen={contextOpen}
            onContextToggle={onContextToggle}
          />
          {sending ? (
            <button
              type="button"
              className={styles.sendButton}
              aria-label="Stop Agent response"
              title="Stop Agent response"
              onClick={onStop}
            >
              <Square aria-hidden size={14} />
            </button>
          ) : (
            <button
              type="submit"
              className={styles.sendButton}
              aria-label="Send"
              title="Send"
              disabled={composerDisabled}
            >
              <SendHorizontal aria-hidden size={16} />
            </button>
          )}
        </div>
      </form>
      <p id="agent-composer-hint" className={styles.composerHint}>
        Enter to send · Shift + Enter for a new line
      </p>
    </div>
  );
}

function AgentSourceContext({
  activeScope,
  sourceCount,
  assistantKind,
  contextOpen,
  onContextToggle,
}: Pick<
  AgentComposerProps,
  "activeScope" | "sourceCount" | "assistantKind" | "contextOpen" | "onContextToggle"
>) {
  return (
    <div className={styles.sourceContext}>
      {activeScope?.kind === "document" ? (
        <Link href={activeScope.href} aria-label={`Open ${activeScope.title}`}>
          This page
        </Link>
      ) : (
        <span>Workspace</span>
      )}
      <span aria-hidden>·</span>
      <button
        type="button"
        aria-label={`View Agent context, ${countLabel(sourceCount, "attached source")}`}
        aria-haspopup="dialog"
        aria-expanded={contextOpen}
        onClick={onContextToggle}
      >
        {countLabel(sourceCount, "source")}
      </button>
      {assistantKind === "mock" ? <span className={styles.demoLabel}>Demo</span> : null}
    </div>
  );
}

function countLabel(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}
