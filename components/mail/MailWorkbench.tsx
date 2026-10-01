"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, FilePenLine, Plus, Unplug } from "lucide-react";
import type { MailConnection, MailConnector, MailMessage, MailPage } from "@/lib/mail/model";
import {
  createDraft,
  mailAccountKey,
  readDraftsWithStatus,
  writeDrafts,
  type DraftMode,
  type MailDraft,
} from "@/lib/mail/drafts";
import MailFolderNav from "./MailFolderNav";
import MailListNotices from "./MailListNotices";
import MailMessageList, { MailListHeader, MailMessageFilters } from "./MailMessageList";
import MailReadingPane from "./MailReadingPane";
import MailComposer from "./MailComposer";
import styles from "./MailWorkspace.module.css";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Mail could not be loaded.";
}

// eslint-disable-next-line complexity -- coordinates folder loading with account-scoped local drafts
export default function MailWorkbench({
  connector,
  connection,
  demo = false,
  onDisconnect,
  embedded = false,
}: {
  connector: MailConnector;
  connection: MailConnection;
  demo?: boolean;
  onDisconnect?: () => void;
  embedded?: boolean;
}) {
  const searchParams = useSearchParams();
  const requestedFolder = searchParams?.get("folder");
  const folderId =
    connection.folders.find((folder) => folder.id === requestedFolder)?.id ??
    connection.folders.find((folder) => folder.kind === "inbox")?.id;
  const messageId =
    searchParams?.get("message") ?? (demo && !requestedFolder ? "demo-design-review" : null);
  const folderRequest = useRef(0);
  const [page, setPage] = useState<MailPage | null>(null);
  const [message, setMessage] = useState<MailMessage | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [messageRefresh, setMessageRefresh] = useState(0);
  const accountKey = `${demo ? "demo-" : ""}${mailAccountKey(connection.account)}`;
  const [drafts, setDrafts] = useState<MailDraft[]>([]);
  const draftsRef = useRef<MailDraft[]>([]);
  const [activeDraft, setActiveDraft] = useState<MailDraft | null>(null);
  const [localDrafts, setLocalDrafts] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftReadNotice, setDraftReadNotice] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [sendingEnabled, setSendingEnabled] = useState(false);
  const lifetime = useRef(0);

  useEffect(() => {
    const saved = readDraftsWithStatus(accountKey);
    draftsRef.current = saved.drafts;
    setDrafts(saved.drafts);
    setDraftReadNotice(
      saved.status === "ok"
        ? null
        : saved.status === "corrupt"
          ? "Some local drafts could not be read. Recovered drafts are available in Local drafts."
          : "Browser storage is unavailable. Keep this page open and copy your drafts before leaving."
    );
    return () => {
      lifetime.current += 1;
    };
  }, [accountKey]);

  const persist = useCallback(
    (next: MailDraft[]) => {
      draftsRef.current = next;
      setDrafts(next);
      setStorageFailed(!writeDrafts(accountKey, next));
    },
    [accountKey]
  );

  const updateDraft = (next: MailDraft) => {
    const updated = { ...next, updatedAt: new Date().toISOString() };
    setActiveDraft(updated);
    persist([updated, ...draftsRef.current.filter((item) => item.id !== updated.id)]);
  };
  const beginDraft = (mode: DraftMode) => {
    const next = createDraft(mode, message ?? undefined, connection.account);
    next.accountKey = accountKey;
    updateDraft(next);
    setNotice(null);
  };
  const finishDraft = (delivered: boolean, id = activeDraft?.id, storageSaved = true) => {
    if (delivered && !demo) {
      const saved = readDraftsWithStatus(accountKey);
      const next =
        saved.status === "ok" ? saved.drafts : draftsRef.current.filter((item) => item.id !== id);
      draftsRef.current = next;
      setDrafts(next);
      setStorageFailed(!storageSaved || saved.status !== "ok");
    } else if (id) persist(draftsRef.current.filter((item) => item.id !== id));
    setActiveDraft((current) => (current?.id === id ? null : current));
    if (delivered) {
      setNotice(demo ? "Preview send complete. No email was sent." : "Message sent.");
      void loadFolder();
    }
  };

  const loadFolder = useCallback(async () => {
    if (!folderId) return;
    const request = ++folderRequest.current;
    setLoading(true);
    setError(null);
    setMoreError(null);
    setLoadingMore(false);
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
    setQuery("");
    setUnreadOnly(false);
    setLocalDrafts(false);
    void loadFolder();
    return () => {
      folderRequest.current += 1;
    };
  }, [loadFolder]);

  useEffect(() => {
    let cancelled = false;
    setMessage(null);
    setMessageError(null);
    setActiveDraft(null);
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
  }, [connector, messageId, messageRefresh]);

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
      if (request === folderRequest.current) setLoadingMore(false);
    }
  };

  const folder = connection.folders.find((item) => item.id === folderId);
  const params = new URLSearchParams();
  if (demo) params.set("demo", "1");
  if (folderId) params.set("folder", folderId);
  const folderHref = `/mail${params.size ? `?${params}` : ""}`;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered =
    page?.messages.filter(
      (item) =>
        (!unreadOnly || !item.isRead) &&
        (!normalizedQuery ||
          [item.from, item.subject, item.preview]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalizedQuery))
    ) ?? [];
  const showingDraft = Boolean(activeDraft);

  return (
    <div
      className={`${styles.page} ${styles.workbenchPage}${embedded ? ` ${styles.embedded}` : ""}`}
      data-mail-demo={demo ? "true" : "false"}
    >
      <header className={styles.workbenchHeader}>
        <div className={styles.workbenchIdentity}>
          <h1>Mail</h1>
          <span className={styles.accountLabel}>{connection.account.address}</span>
          {demo && <span className={styles.demoBadge}>Sample inbox</span>}
        </div>
        <div className={styles.headerTools}>
          {demo ? (
            <Link href="/mail" className={styles.textButton}>
              Connect your account <ArrowUpRight aria-hidden />
            </Link>
          ) : (
            onDisconnect && (
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Disconnect mail"
                title="Disconnect mail"
                onClick={onDisconnect}
              >
                <Unplug aria-hidden />
              </button>
            )
          )}
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => beginDraft("compose")}
          >
            <Plus aria-hidden /> Compose
          </button>
        </div>
      </header>
      <div className={styles.workbenchBody}>
        <div className={styles.navigationBar}>
          <MailFolderNav
            folders={connection.folders}
            folderId={localDrafts ? undefined : folderId}
            demo={demo}
          />
          <button
            type="button"
            className={`${styles.localDraftsButton}${localDrafts ? ` ${styles.currentFolder}` : ""}`}
            aria-pressed={localDrafts}
            onClick={() => {
              setLocalDrafts(!localDrafts);
              setQuery("");
            }}
          >
            <FilePenLine aria-hidden /> Local drafts <span>{drafts.length}</span>
          </button>
        </div>
        <div
          className={styles.mailFrame}
          data-message-selected={showingDraft || (!localDrafts && messageId) ? "true" : "false"}
        >
          <section className={styles.listPane} aria-label="Messages">
            <MailMessageFilters
              query={query}
              unreadOnly={unreadOnly}
              onQueryChange={setQuery}
              onUnreadToggle={() => setUnreadOnly(!unreadOnly)}
              localDrafts={localDrafts}
            />
            <MailListHeader
              folderName={localDrafts ? "Local drafts" : (folder?.name ?? "Inbox")}
              count={localDrafts ? drafts.length : page?.messages.length}
              disabled={loading || loadingMore}
              onRefresh={() => void loadFolder()}
              localDrafts={localDrafts}
            />
            <div className={styles.listScroll} data-testid="mail-message-list">
              {localDrafts ? (
                <LocalDraftList
                  drafts={drafts.filter((draft) =>
                    [draft.to, draft.subject, draft.bodyText]
                      .join(" ")
                      .toLocaleLowerCase()
                      .includes(normalizedQuery)
                  )}
                  activeId={activeDraft?.id}
                  onSelect={(draft) => {
                    setActiveDraft(draft);
                    setNotice(null);
                  }}
                />
              ) : (
                <>
                  <MailListNotices
                    loading={loading}
                    loadingMore={loadingMore}
                    hasPage={Boolean(page)}
                    error={error}
                    moreError={moreError}
                    onRetryFolder={() => void loadFolder()}
                    onRetryMore={() => void loadMore()}
                  />
                  <MailMessageList
                    loading={loading}
                    loadingMore={loadingMore}
                    hasPage={Boolean(page)}
                    error={error}
                    hasMessages={Boolean(page?.messages.length)}
                    hasMore={Boolean(page?.nextPageUrl)}
                    filtered={filtered}
                    selectedId={messageId}
                    folderHref={folderHref}
                    onClearFilters={() => {
                      setQuery("");
                      setUnreadOnly(false);
                    }}
                    onLoadMore={() => void loadMore()}
                  />
                </>
              )}
            </div>
            <div className={styles.listFootnote}>
              {localDrafts
                ? "Saved on this browser · not synced"
                : demo
                  ? "Example messages · no account connected"
                  : `${connector.label} · ${sendingEnabled ? "Sending enabled" : "Read access"}`}
            </div>
          </section>
          <section
            className={styles.readPane}
            aria-label="Message preview"
            data-testid="mail-message-detail"
          >
            {(draftReadNotice || storageFailed) && (
              <p className={styles.deliveryNotice} role="alert">
                {storageFailed
                  ? "Changes to local drafts could not be saved. Keep a copy before leaving; removed drafts may reappear after reload."
                  : draftReadNotice}
              </p>
            )}
            {deliveryError && (
              <p className={styles.deliveryNotice} role="alert">
                {deliveryError}
                <button
                  className={styles.textButton}
                  type="button"
                  onClick={() => setDeliveryError(null)}
                >
                  Dismiss
                </button>
              </p>
            )}
            {notice && (
              <p className={styles.deliveryNotice} role="status">
                {notice}
                <button className={styles.textButton} type="button" onClick={() => setNotice(null)}>
                  Dismiss
                </button>
              </p>
            )}
            {(!activeDraft || activeDraft.mode !== "compose") && !localDrafts && (
              <MailReadingPane
                messageId={messageId}
                message={message}
                connector={connector}
                error={messageError}
                folderHref={folderHref}
                folderName={folder?.name ?? "Inbox"}
                onRetry={() => setMessageRefresh((value) => value + 1)}
                onDraft={beginDraft}
              />
            )}
            {activeDraft ? (
              <MailComposer
                key={activeDraft.id}
                draft={activeDraft}
                accountAddress={connection.account.address}
                connector={connector}
                demo={demo}
                sendingEnabled={sendingEnabled}
                onSendingEnabled={() => setSendingEnabled(true)}
                onChange={updateDraft}
                storageFailed={storageFailed}
                onClose={() => setActiveDraft(null)}
                onDiscard={() => finishDraft(false)}
                onSent={(storageSaved) => finishDraft(true, activeDraft.id, storageSaved)}
                onSendFailure={setDeliveryError}
                lifetime={lifetime}
              />
            ) : (
              localDrafts && (
                <div className={styles.selectPrompt}>
                  <FilePenLine aria-hidden />
                  <h2>Your words, kept here.</h2>
                  <p>Select a draft to continue writing.</p>
                  <button
                    className={styles.quietButton}
                    type="button"
                    onClick={() => beginDraft("compose")}
                  >
                    Write a message
                  </button>
                </div>
              )
            )}
            {activeDraft && (
              <Link
                href={folderHref}
                onClick={() => setActiveDraft(null)}
                className={styles.narrowBack}
              >
                <ArrowLeft aria-hidden /> Back to{" "}
                {localDrafts ? "drafts" : (folder?.name ?? "Inbox")}
              </Link>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function LocalDraftList({
  drafts,
  activeId,
  onSelect,
}: {
  drafts: MailDraft[];
  activeId?: string;
  onSelect: (draft: MailDraft) => void;
}) {
  if (!drafts.length)
    return (
      <div className={styles.empty} role="status">
        <FilePenLine aria-hidden />
        <h3>No local drafts</h3>
        <p>Start a message. Your changes will be saved here.</p>
      </div>
    );
  return (
    <ul className={styles.messageList}>
      {drafts.map((draft) => (
        <li key={draft.id}>
          <button
            type="button"
            className={`${styles.messageRow}${draft.id === activeId ? ` ${styles.selected}` : ""}`}
            onClick={() => onSelect(draft)}
          >
            <span className={styles.rowTop}>
              <strong>{draft.to || "No recipients yet"}</strong>
              <time dateTime={draft.updatedAt}>
                {new Date(draft.updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </span>
            <span className={styles.subject}>
              <span className={styles.subjectText}>{draft.subject || "Untitled draft"}</span>
            </span>
            <span className={styles.preview}>{draft.bodyText || "Start writing…"}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
