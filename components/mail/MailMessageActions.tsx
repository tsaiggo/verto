"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, LoaderCircle, Mail, MailOpen, Star, Trash2 } from "lucide-react";
import type {
  MailConnector,
  MailMessage,
  MailMessageAction,
  MailMutationResult,
} from "@/lib/mail/model";
import styles from "./MailMessageActions.module.css";

export default function MailMessageActions({
  message,
  connector,
  onChanged,
}: {
  message: MailMessage;
  connector: MailConnector;
  onChanged: (originalId: string, result: MailMutationResult, action: MailMessageAction) => void;
}) {
  const [busyAction, setBusyAction] = useState<MailMessageAction["type"] | null>(null);
  const busy = busyAction !== null;
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const update = async (action: MailMessageAction) => {
    if (pending.current || !connector.mutateMessage) return;
    pending.current = true;
    setBusyAction(action.type);
    setError(null);
    try {
      // The consent flow belongs to this explicit click and this message's account.
      await connector.enableUpdating?.(message.id);
      const result = await connector.mutateMessage(message.id, action);
      onChanged(message.id, result, action);
    } catch (cause) {
      if (mounted.current)
        setError(cause instanceof Error ? cause.message : "This message could not be updated.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusyAction(null);
    }
  };
  const disabled = busy || !connector.mutateMessage;
  return (
    <div className={styles.tools}>
      <div className={styles.actions} role="group" aria-label="Message actions" aria-busy={busy}>
        <button
          type="button"
          disabled={disabled}
          aria-label={message.isRead ? "Mark unread" : "Mark read"}
          title={message.isRead ? "Mark unread" : "Mark read"}
          onClick={() => void update({ type: "read", value: !message.isRead })}
        >
          {busyAction === "read" ? (
            <LoaderCircle aria-hidden className={styles.pending} />
          ) : message.isRead ? (
            <Mail aria-hidden />
          ) : (
            <MailOpen aria-hidden />
          )}
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label={message.isStarred ? "Unstar message" : "Star message"}
          aria-pressed={Boolean(message.isStarred)}
          title={message.isStarred ? "Unstar message" : "Star message"}
          onClick={() => void update({ type: "star", value: !message.isStarred })}
        >
          {busyAction === "star" ? (
            <LoaderCircle aria-hidden className={styles.pending} />
          ) : (
            <Star aria-hidden className={message.isStarred ? styles.starred : undefined} />
          )}
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label="Archive message"
          title="Archive message"
          onClick={() => void update({ type: "archive" })}
        >
          {busyAction === "archive" ? (
            <LoaderCircle aria-hidden className={styles.pending} />
          ) : (
            <Archive aria-hidden />
          )}
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label="Move to Trash"
          title="Move to Trash"
          onClick={() => void update({ type: "trash" })}
        >
          {busyAction === "trash" ? (
            <LoaderCircle aria-hidden className={styles.pending} />
          ) : (
            <Trash2 aria-hidden />
          )}
        </button>
      </div>
      {error && (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
