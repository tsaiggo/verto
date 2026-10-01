"use client";

import Link from "./MailViewLink";
import { useState } from "react";
import { ArrowLeft, Download, Forward, Mail, Paperclip, Reply, ReplyAll } from "lucide-react";
import type {
  MailAttachment,
  MailConnector,
  MailMessage,
  MailMessageAction,
  MailMutationResult,
} from "@/lib/mail/model";
import type { DraftMode } from "@/lib/mail/drafts";
import { mailSender } from "@/lib/mail/addresses";
import MailSenderAvatar from "./MailSenderAvatar";
import MailMessageActions from "./MailMessageActions";
import styles from "./MailWorkspace.module.css";
import content from "./MailContent.module.css";

export default function MailReadingPane({
  messageId,
  message,
  error,
  connector,
  folderHref,
  folderName,
  onRetry,
  onDraft,
  onChanged,
}: {
  messageId: string | null;
  message: MailMessage | null;
  error: string | null;
  connector: MailConnector;
  folderHref: string;
  folderName: string;
  onRetry: () => void;
  onDraft: (mode: DraftMode) => void;
  onChanged?: (originalId: string, result: MailMutationResult, action: MailMessageAction) => void;
}) {
  if (!messageId)
    return (
      <div className={styles.selectPrompt}>
        <Mail aria-hidden />
        <h2>A little room to read.</h2>
        <p>Select a message to read it.</p>
      </div>
    );
  const sender = mailSender(message?.from ?? "");
  return (
    <>
      <div className={styles.readToolbar}>
        <div className={styles.readTools}>
          <div className={styles.replyActions}>
            <button type="button" disabled={!message} onClick={() => onDraft("reply")}>
              <Reply aria-hidden /> Reply
            </button>
            <button type="button" disabled={!message} onClick={() => onDraft("replyAll")}>
              <ReplyAll aria-hidden /> Reply all
            </button>
            <button type="button" disabled={!message} onClick={() => onDraft("forward")}>
              <Forward aria-hidden /> Forward
            </button>
          </div>
          {message && onChanged && (
            <MailMessageActions
              key={message.id}
              message={message}
              connector={connector}
              onChanged={onChanged}
            />
          )}
        </div>
        <Link href={folderHref} className={styles.backLink} aria-label={`Back to ${folderName}`}>
          <ArrowLeft aria-hidden />
          <span>Back to {folderName}</span>
        </Link>
      </div>
      {error ? (
        <div className={styles.messageNotice} role="alert">
          <strong>Couldn’t open this message</strong>
          <p>{error}</p>
          <button className={styles.quietButton} type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : message ? (
        <article className={`${styles.message} ${content.message}`}>
          <header className={styles.messageHeading}>
            <div className={styles.messageContent} data-testid="mail-message-heading-content">
              <div className={`${styles.senderMeta} ${content.senderMeta}`}>
                <MailSenderAvatar from={message.from} />
                <div className={`${styles.senderCopy} ${content.senderCopy}`}>
                  <h2>{message.subject || "(No subject)"}</h2>
                  <span>
                    {sender.name || sender.address || "Unknown sender"}
                    {sender.name && sender.address && <> · {sender.address}</>}
                  </span>
                </div>
                <time dateTime={message.receivedAt}>
                  {new Date(message.receivedAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              {message.mailAccount && (
                <p className={content.receivingAccount}>
                  Received by {message.mailAccount.address}
                </p>
              )}
              <details className={`${styles.recipientDetails} ${content.recipientDetails}`}>
                <summary>
                  To{" "}
                  {message.to.map((item) => mailSender(item).name || item).join(", ") ||
                    "undisclosed recipients"}
                </summary>
                <dl>
                  <div>
                    <dt>From</dt>
                    <dd>{message.from}</dd>
                  </div>
                  <div>
                    <dt>To</dt>
                    <dd>{message.to.join(", ") || "Undisclosed recipients"}</dd>
                  </div>
                  {Boolean(message.cc?.length) && (
                    <div>
                      <dt>Cc</dt>
                      <dd>{message.cc?.join(", ")}</dd>
                    </div>
                  )}
                </dl>
              </details>
            </div>
          </header>
          <div
            className={`${styles.messageContent} ${styles.body} ${content.body}`}
            data-testid="mail-message-body"
          >
            {message.bodyText || message.preview}
          </div>
          {Boolean(message.attachments?.length) && (
            <div
              className={`${styles.messageContent} ${styles.attachments}`}
              data-testid="mail-message-attachments"
            >
              <h3>
                <Paperclip aria-hidden /> {message.attachments!.length} attachment
                {message.attachments!.length === 1 ? "" : "s"}
              </h3>
              {message.attachments!.map((attachment) => (
                <Attachment
                  key={attachment.id}
                  attachment={attachment}
                  messageId={message.id}
                  connector={connector}
                />
              ))}
            </div>
          )}
          {message.hasAttachments && !message.attachments?.length && (
            <p className={`${styles.messageContent} ${styles.attachmentHint}`}>
              <Paperclip aria-hidden /> This message includes attachments. Open your mail provider
              to view them.
            </p>
          )}
        </article>
      ) : (
        <p className={styles.status} role="status">
          Loading message…
        </p>
      )}
    </>
  );
}

function Attachment({
  attachment,
  messageId,
  connector,
}: {
  attachment: MailAttachment;
  messageId: string;
  connector: MailConnector;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const download = async () => {
    if (!connector.getAttachment || loading) return;
    setLoading(true);
    setError(null);
    try {
      const blob = await connector.getAttachment(messageId, attachment);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.name;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Attachment could not be downloaded. Try again."
      );
    } finally {
      setLoading(false);
    }
  };
  const size =
    attachment.size >= 1024 * 1024
      ? `${(attachment.size / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.ceil(attachment.size / 1024))} KB`;
  return (
    <div>
      <button
        type="button"
        className={`${styles.attachment} ${content.attachment}`}
        disabled={loading || !connector.getAttachment}
        onClick={() => void download()}
        aria-label={`Download ${attachment.name}`}
      >
        <span className={styles.attachmentFile}>
          <Paperclip aria-hidden />
          <span>
            <strong>{attachment.name}</strong>
            <small>{loading ? "Downloading…" : size}</small>
          </span>
        </span>
        <Download aria-hidden />
      </button>
      {error && (
        <p className={styles.inlineError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
