"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Mail, RefreshCw, Unplug } from "lucide-react";
import { StatusNotice } from "@/components/feedback/StatusNotice";
import MailListNotices from "@/components/mail/MailListNotices";
import PageHeader from "@/components/layout/PageHeader";
import PageFrame from "@/components/layout/PageFrame";
import { getMailConnectors } from "@/lib/mail/connectors";
import type { MailConnector, MailMessage, MailMessageSummary, MailPage } from "@/lib/mail/model";
import {
  getMailSession,
  setMailSession,
  useMailSession,
  type MailSession,
} from "@/lib/mail/session";
import styles from "./MailWorkspace.module.css";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Mail could not be loaded.";
}

const connectionNoticeCopy = {
  restoring: {
    tone: "pending",
    title: "Checking your mail connection",
    description: "Looking for an existing Gmail or Outlook session.",
  },
  connecting: {
    tone: "pending",
    title: "Connecting your mail account",
    description: "Complete the provider sign-in to continue.",
  },
  disconnected: {
    tone: "warning",
    title: "Mail is not configured",
    description: "Gmail or Outlook needs provider setup before you can connect.",
  },
} as const;

function ConnectionStatus({ session, configured }: { session: MailSession; configured: boolean }) {
  if (session.status === "connected" || (session.status === "disconnected" && configured))
    return null;
  const notice =
    session.status === "error"
      ? {
          tone: "warning" as const,
          title: "Mail connection needs attention",
          description: session.message,
        }
      : connectionNoticeCopy[session.status];
  return <StatusNotice {...notice} className={styles.connectNotice} />;
}

export default function MailWorkspace() {
  const connectors = useMemo(() => getMailConnectors(), []);
  const available = connectors.filter((connector) => connector.isConfigured());
  const session = useMailSession();
  const sessionRequest = useRef(0);

  useEffect(() => {
    if (getMailSession().connection) return;
    let cancelled = false;
    const request = ++sessionRequest.current;
    if (available.length) setMailSession({ status: "restoring", connection: null });
    async function restore() {
      for (const connector of available) {
        try {
          const connection = await connector.restore();
          if (cancelled || request !== sessionRequest.current) return;
          if (connection) {
            setMailSession({ status: "connected", connection });
            return;
          }
        } catch (error) {
          if (!cancelled && request === sessionRequest.current) {
            setMailSession({ status: "error", connection: null, message: errorMessage(error) });
          }
          return;
        }
      }
      if (!cancelled && request === sessionRequest.current) {
        setMailSession({ status: "disconnected", connection: null });
      }
    }
    void restore();
    return () => {
      cancelled = true;
      sessionRequest.current += 1;
    };
    // Connector configuration is fixed for the lifetime of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = useCallback(async (connector: MailConnector) => {
    const request = ++sessionRequest.current;
    setMailSession({ status: "connecting", connection: null });
    try {
      await connector.connect();
      const connection = await connector.restore();
      if (request !== sessionRequest.current) return;
      setMailSession(
        connection
          ? { status: "connected", connection }
          : { status: "disconnected", connection: null }
      );
    } catch (error) {
      if (request === sessionRequest.current) {
        setMailSession({ status: "error", connection: null, message: errorMessage(error) });
      }
    }
  }, []);

  const disconnect = useCallback(async () => {
    const request = ++sessionRequest.current;
    const provider = session.connection?.account.provider;
    const connector = connectors.find((item) => item.id === provider);
    if (!connector) return;
    try {
      await connector.disconnect();
      if (request === sessionRequest.current) {
        setMailSession({ status: "disconnected", connection: null });
      }
    } catch (error) {
      if (request === sessionRequest.current) {
        setMailSession({ status: "error", connection: null, message: errorMessage(error) });
      }
    }
  }, [connectors, session.connection]);

  const connector = connectors.find((item) => item.id === session.connection?.account.provider);

  return (
    <div className={styles.page}>
      <PageHeader
        title="Mail"
        subtitle={
          session.connection
            ? `Read-only view of ${session.connection.account.address}`
            : "Read your mail alongside your library."
        }
        frame="wide"
        tools={
          session.connection ? (
            <button type="button" className={styles.quietButton} onClick={disconnect}>
              <Unplug aria-hidden="true" /> Disconnect
            </button>
          ) : undefined
        }
      />
      <PageFrame size="wide" className={styles.frame}>
        {session.connection && connector ? (
          <ConnectedMail connector={connector} />
        ) : (
          <div className={styles.connectCard} id="connect">
            <Mail className={styles.connectIcon} aria-hidden="true" />
            <h2>Connect your mail</h2>
            <p>
              Verto requests read-only access to show your messages. It cannot send or delete mail.
            </p>
            <ConnectionStatus session={session} configured={available.length > 0} />
            {available.length > 0 ? (
              <div className={styles.connectActions}>
                {available.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={styles.primaryButton}
                    disabled={session.status === "connecting" || session.status === "restoring"}
                    onClick={() => void connect(item)}
                  >
                    {session.status === "restoring"
                      ? "Preparing…"
                      : session.status === "connecting"
                        ? "Connecting…"
                        : `Connect ${item.label}`}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </PageFrame>
    </div>
  );
}

// eslint-disable-next-line complexity -- coordinates folder paging and the selected read-only message
function ConnectedMail({ connector }: { connector: MailConnector }) {
  const { connection } = useMailSession();
  const searchParams = useSearchParams();
  const requestedFolder = searchParams?.get("folder");
  const folderId =
    connection?.folders.find((folder) => folder.id === requestedFolder)?.id ??
    connection?.folders.find((folder) => folder.kind === "inbox")?.id;
  const messageId = searchParams?.get("message") ?? null;
  const folderRequest = useRef(0);
  const [page, setPage] = useState<MailPage | null>(null);
  const [message, setMessage] = useState<MailMessage | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);

  const loadFolder = useCallback(async () => {
    if (!folderId) return;
    const request = ++folderRequest.current;
    setLoading(true);
    setError(null);
    setMoreError(null);
    try {
      const result = await connector.listMessages(folderId);
      if (request === folderRequest.current) setPage(result);
    } catch (cause) {
      if (request === folderRequest.current) setError(errorMessage(cause));
    } finally {
      if (request === folderRequest.current) setLoading(false);
    }
  }, [connector, folderId]);

  useEffect(() => {
    setPage(null);
    void loadFolder();
    return () => {
      folderRequest.current += 1;
    };
  }, [loadFolder]);

  useEffect(() => {
    let cancelled = false;
    setMessage(null);
    setMessageError(null);
    if (!messageId) return;
    connector
      .getMessage(messageId)
      .then((item) => {
        if (!cancelled) setMessage(item);
      })
      .catch((cause) => {
        if (!cancelled) setMessageError(errorMessage(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [connector, messageId]);

  const loadMore = async () => {
    if (!page?.nextPageUrl || loading || loadingMore || !folderId) return;
    const request = folderRequest.current;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = await connector.listMessages(folderId, page.nextPageUrl);
      if (request !== folderRequest.current) return;
      setPage((current) =>
        current
          ? { messages: [...current.messages, ...next.messages], nextPageUrl: next.nextPageUrl }
          : next
      );
    } catch (cause) {
      if (request === folderRequest.current) setMoreError(errorMessage(cause));
    } finally {
      setLoadingMore(false);
    }
  };

  const folder = connection?.folders.find((item) => item.id === folderId);
  const folderHref = folderId ? `/mail?folder=${encodeURIComponent(folderId)}` : "/mail";

  return (
    <div className={styles.mailFrame} data-message-selected={messageId ? "true" : "false"}>
      <section className={styles.listPane} aria-label="Messages">
        <header className={styles.listHeader}>
          <div>
            <h2>{folder?.name ?? "Inbox"}</h2>
            <p>{page ? `${page.messages.length} messages` : "Your latest messages"}</p>
          </div>
          <button
            type="button"
            className={styles.quietButton}
            disabled={loading || loadingMore}
            onClick={() => void loadFolder()}
          >
            <RefreshCw aria-hidden="true" /> Refresh
          </button>
        </header>
        <MailListNotices
          loading={loading}
          loadingMore={loadingMore}
          hasPage={Boolean(page)}
          error={error}
          moreError={moreError}
          onRetryFolder={() => void loadFolder()}
          onRetryMore={() => void loadMore()}
        />
        {loading && !page ? null : error && !page ? null : page?.messages.length ? (
          <>
            <ul className={styles.messageList}>
              {page.messages.map((item) => (
                <MessageRow
                  key={item.id}
                  item={item}
                  folderHref={folderHref}
                  selected={item.id === messageId}
                />
              ))}
            </ul>
            {page.nextPageUrl && (
              <button
                type="button"
                className={styles.moreButton}
                disabled={loading || loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </>
        ) : (
          <p className={styles.status}>No messages in this folder.</p>
        )}
      </section>

      <MessagePreview
        messageId={messageId}
        message={message}
        error={messageError}
        folderHref={folderHref}
        folderName={folder?.name ?? "Inbox"}
      />
    </div>
  );
}

function MessagePreview({
  messageId,
  message,
  error,
  folderHref,
  folderName,
}: {
  messageId: string | null;
  message: MailMessage | null;
  error: string | null;
  folderHref: string;
  folderName: string;
}) {
  return (
    <section className={styles.readPane} aria-label="Message preview">
      {messageId ? (
        <div className={styles.message}>
          <Link href={folderHref} className={styles.backLink}>
            <ArrowLeft aria-hidden="true" /> Back to {folderName}
          </Link>
          {error ? (
            <StatusNotice
              tone="warning"
              title="Couldn’t open this message"
              description={error}
              className={styles.messageNotice}
            />
          ) : message ? (
            <article>
              <h2>{message.subject || "(No subject)"}</h2>
              <div className={styles.meta}>
                <span>From: {message.from}</span>
                <span>To: {message.to.join(", ")}</span>
                <time dateTime={message.receivedAt}>
                  {new Date(message.receivedAt).toLocaleString()}
                </time>
              </div>
              <div className={styles.body}>{message.bodyText || message.preview}</div>
            </article>
          ) : (
            <p className={styles.status} role="status">
              Loading message…
            </p>
          )}
        </div>
      ) : (
        <div className={styles.selectPrompt}>
          <Mail aria-hidden="true" />
          <p>Select a message to read it.</p>
        </div>
      )}
    </section>
  );
}

function MessageRow({
  item,
  folderHref,
  selected,
}: {
  item: MailMessageSummary;
  folderHref: string;
  selected: boolean;
}) {
  const href = `${folderHref}${folderHref.includes("?") ? "&" : "?"}message=${encodeURIComponent(item.id)}`;
  return (
    <li>
      <Link
        href={href}
        className={`${styles.messageRow}${selected ? ` ${styles.selected}` : ""}${item.isRead ? "" : ` ${styles.unread}`}`}
        aria-current={selected ? "true" : undefined}
      >
        <span className={styles.rowTop}>
          <strong>{item.from}</strong>
          <time dateTime={item.receivedAt}>{new Date(item.receivedAt).toLocaleDateString()}</time>
        </span>
        <span className={styles.subject}>{item.subject || "(No subject)"}</span>
        <span className={styles.preview}>{item.preview}</span>
      </Link>
    </li>
  );
}
