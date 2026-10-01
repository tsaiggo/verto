"use client";

import Link from "next/link";
import { Check, Loader2, RefreshCcw, Undo2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AgentThreadMessage } from "@/lib/agent-threads";
import styles from "./AgentWorkspace.module.css";

function AgentMarkdown({ text }: { text: string }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

export function AgentMessage({ msg }: { msg: AgentThreadMessage }) {
  if (msg.role === "user") {
    return (
      <article
        className={`${styles.message} ${styles.userMessage}`}
        data-agent-message
        data-role="user"
        aria-label="Your message"
      >
        <span className={styles.messageLabel}>You</span>
        <div className={styles.userText}>{msg.text}</div>
      </article>
    );
  }

  if (msg.role === "tool") return null;

  return (
    <article
      className={styles.message}
      data-agent-message
      data-role="assistant"
      aria-label="Agent response"
    >
      <span className={styles.messageLabel}>Agent</span>
      {msg.text ? <AgentMarkdown text={msg.text} /> : null}
      {msg.list ? (
        <ol className={styles.messageList}>
          {msg.list.map((item) => (
            <li key={item.term}>
              <strong>{item.term}.</strong> {item.text}
            </li>
          ))}
        </ol>
      ) : null}
      {msg.citations?.length ? (
        <div className={styles.citations} role="group" aria-label="Sources cited">
          {msg.citations.map((cite) => (
            <Link key={cite.index} href={cite.href} className={styles.citation}>
              <span>{cite.index}</span>
              {cite.label}
            </Link>
          ))}
        </div>
      ) : null}
      {msg.receipt ? (
        <p className={styles.receipt} role="status">
          {msg.receipt.undoneAt ? <Undo2 aria-hidden /> : <Check aria-hidden />}
          {msg.receipt.undoneAt
            ? "Approved change undone"
            : "Approved change applied · Open the source page to undo"}
        </p>
      ) : null}
    </article>
  );
}

export function AgentThinkingMessage() {
  return (
    <div className={styles.thinking} role="status">
      <Loader2 aria-hidden className={styles.spinner} size={16} />
      <span>Thinking…</span>
    </div>
  );
}

export function AgentRecoveryMessage({
  message,
  onRestorePrompt,
  onRetry,
}: {
  message: string;
  onRestorePrompt: () => void;
  onRetry: () => void;
}) {
  return (
    <div className={`${styles.message} ${styles.recovery}`} role="alert">
      <span className={styles.messageLabel}>Agent</span>
      <p>{message}</p>
      <div className={styles.recoveryActions}>
        <button type="button" className={styles.textButton} onClick={onRestorePrompt}>
          <Undo2 aria-hidden />
          Restore prompt
        </button>
        <button type="button" className={styles.textButton} onClick={onRetry}>
          <RefreshCcw aria-hidden />
          Try again
        </button>
      </div>
    </div>
  );
}
