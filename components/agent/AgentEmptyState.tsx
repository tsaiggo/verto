"use client";

import Link from "next/link";
import { Files, KeyRound, MessageSquareText, Settings2 } from "lucide-react";
import styles from "./AgentWorkspace.module.css";

interface AgentEmptyStateProps {
  assistantKind: "none" | "mock" | "github";
  isReady: boolean;
  providerReady: boolean;
  isGrounded: boolean;
  workspaceStatus: "ready" | "loading" | "error";
}

export function AgentEmptyCompact() {
  return (
    <div className={styles.emptyState}>
      <MessageSquareText aria-hidden size={20} />
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
}: AgentEmptyStateProps) {
  if (!providerReady) {
    const unavailable = assistantKind === "none";
    const Icon = unavailable ? Settings2 : KeyRound;
    return (
      <div className={styles.emptyState}>
        <Icon aria-hidden size={20} />
        <h2>
          {unavailable ? "AI is not enabled in this version of Verto" : "Add an Agent key to start"}
        </h2>
        {!unavailable ? <p>Add this device’s access key in AI & Agent settings.</p> : null}
        <Link href="/settings/agent" className={styles.emptyAction}>
          Open AI & Agent settings
        </Link>
        <Link href="/library" className={styles.secondaryLink}>
          Browse Local library
        </Link>
      </div>
    );
  }

  if (!isReady) {
    const loading = workspaceStatus === "loading";
    const error = workspaceStatus === "error";
    return (
      <div className={styles.emptyState} role={loading ? "status" : undefined}>
        <Files aria-hidden size={20} />
        <h2>
          {loading
            ? "Loading your local library"
            : error
              ? "Reconnect your local library"
              : "Connect a readable source"}
        </h2>
        <p>
          {loading
            ? "Agent will be ready when your sources finish loading."
            : error
              ? "Verto couldn’t read the selected local folder."
              : "Agent needs a Markdown or MDX document to read."}
        </p>
        {!loading ? (
          <Link href="/integrations" className={styles.emptyAction}>
            Manage sources
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.emptyState}>
      <MessageSquareText aria-hidden size={20} />
      <h2>{isGrounded ? "Ask about your sources" : "Try the Agent demo"}</h2>
      <p>
        {isGrounded
          ? "Answers cite the sources the Agent opens."
          : "This build uses deterministic responses without a live model."}
      </p>
    </div>
  );
}
