"use client";

import Link from "./MailViewLink";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, FilePenLine, Plus, Unplug } from "lucide-react";
import type { MailConnection, MailConnector, MailMessage, MailPage } from "@/lib/mail/model";
import type { LocalMailStatus } from "@/lib/mail/local-types";
import {
  createDraft,
  mailAccountKey,
  readDraftsWithStatus,
  writeDrafts,
  type DraftMode,
  type MailDraft,
} from "@/lib/mail/drafts";
import { isDraftSending } from "@/lib/mail/delivery";
import { sortMailMessages, type MailAccountBinding } from "@/lib/mail/unified";
import { mailHref, readMailView, saveMailView, type MailPreview } from "@/lib/mail/view-state";
import MailFolderNav from "./MailFolderNav";
import MailListNotices from "./MailListNotices";
import MailMessageList, { MailListHeader, MailMessageFilters } from "./MailMessageList";
import MailReadingPane from "./MailReadingPane";
import MailComposer from "./MailComposer";
import MailFromPicker from "./MailFromPicker";
import styles from "./MailWorkspace.module.css";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Mail could not be loaded.";
}

// eslint-disable-next-line complexity -- coordinates folder loading with account-scoped local drafts
export default function MailWorkbench({
  connector,
  connection,
  demo = false,
  preview,
  onDisconnect,
  embedded = false,
  accounts: suppliedAccounts,
  scopeId,
  accountParam,
  accountControl,
  connectionNotice,
}: {
  connector: MailConnector;
  connection: MailConnection;
  demo?: boolean;
  preview?: MailPreview;
  onDisconnect?: () => void;
  embedded?: boolean;
  accounts?: MailAccountBinding[];
  scopeId?: string;
  accountParam?: string;
  accountControl?: ReactNode;
  connectionNotice?: string;
}) {
  const searchParams = useSearchParams();
  const requestedFolder = searchParams?.get("folder");
  const folderId =
    connection.folders.find((folder) => folder.id === requestedFolder)?.id ??
    connection.folders.find((folder) => folder.kind === "inbox")?.id;
  const accounts = useMemo(
    () =>
      suppliedAccounts ?? [
        { id: `${connection.account.provider}:${connection.account.id}`, connector, connection },
      ],
    [suppliedAccounts, connection, connector]
  );
  const all = scopeId === "all";
  const viewKey = `${demo ? "demo:" : ""}${scopeId ?? accounts[0].id}`;
  const savedView = useRef(readMailView(viewKey));
  const messageId =
    searchParams?.get("message") ??
    (demo && !preview && !requestedFolder && !all && connection.account.provider === "google"
      ? "demo-design-review"
      : null);
  const folderRequest = useRef(0);
  const messageRequest = useRef(0);
  const clearedMessage = useRef<string | null>(null);
  const currentMessageId = useRef(messageId);
  currentMessageId.current = messageId;
  const [page, setPage] = useState<MailPage | null>(null);
  const [message, setMessage] = useState<MailMessage | null>(null);
  const currentMessageRef = useRef(message);
  currentMessageRef.current = message;
  const [messageError, setMessageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [query, setQuery] = useState(savedView.current?.query ?? "");
  const [unreadOnly, setUnreadOnly] = useState(savedView.current?.unreadOnly ?? false);
  const [searchAllSaved, setSearchAllSaved] = useState(savedView.current?.searchAllSaved ?? false);
  const local = connector.local;
  const [localStatus, setLocalStatus] = useState<LocalMailStatus | undefined>(() =>
    folderId ? local?.getStatus(folderId) : undefined
  );
  const [messageRefresh, setMessageRefresh] = useState(0);
  const draftKey = (entry: MailAccountBinding) =>
    `${demo ? "demo-" : ""}${mailAccountKey(entry.connection.account)}`;
  const draftAccounts = all
    ? accounts
    : accounts.filter(
        (entry) =>
          entry.connection.account.id === connection.account.id &&
          entry.connector.id === connection.account.provider
      );
  const accountKeys = draftAccounts.map(draftKey);
  const accountKey = accountKeys.join("|");
  const [drafts, setDrafts] = useState<MailDraft[]>([]);
  const draftsRef = useRef<MailDraft[]>([]);
  const [activeDraft, setActiveDraft] = useState<MailDraft | null>(null);
  const [localDrafts, setLocalDrafts] = useState(savedView.current?.localDrafts ?? false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftReadNotice, setDraftReadNotice] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const [sendingAccounts, setSendingAccounts] = useState<Set<string>>(() => new Set());
  const lifetime = useRef(0);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const detailScrollRef = useRef<HTMLElement>(null);
  const previousFolder = useRef(folderId);
  const previousMessage = useRef(messageId);
  const listRestored = useRef(false);
  const detailRestored = useRef(false);
  const viewSnapshot = useRef({
    folder: folderId,
    message: messageId ?? undefined,
    query,
    unreadOnly,
    localDrafts,
    searchAllSaved,
    draftId: activeDraft?.id,
    listScroll: 0,
    detailScroll: 0,
  });
  viewSnapshot.current = {
    ...viewSnapshot.current,
    folder: folderId,
    message: messageId ?? undefined,
    query,
    unreadOnly,
    localDrafts,
    searchAllSaved,
    draftId: activeDraft?.id,
  };

  const readScopedDrafts = () => {
    const saved = accountKeys.map((key) => readDraftsWithStatus(key));
    return {
      drafts: saved
        .flatMap((entry) => entry.drafts)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      status: saved.some((entry) => entry.status === "unavailable")
        ? "unavailable"
        : saved.some((entry) => entry.status === "corrupt")
          ? "corrupt"
          : "ok",
    };
  };

  useEffect(() => {
    const saved = readScopedDrafts();
    draftsRef.current = saved.drafts;
    setDrafts(saved.drafts);
    setDraftReadNotice(
      saved.status === "ok"
        ? null
        : saved.status === "corrupt"
          ? "Some local drafts could not be read. Recovered drafts are available in Local drafts."
          : "Browser storage is unavailable. Keep this page open and copy your drafts before leaving."
    );
    setActiveDraft((current) => {
      if (current && accounts.some((entry) => draftKey(entry) === current.accountKey))
        return current;
      return saved.drafts.find((draft) => draft.id === savedView.current?.draftId) ?? null;
    });
    // Mounted account scopes own the local draft set; account switch remounts this workbench.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey, viewKey]);
  useEffect(
    () => () => {
      lifetime.current += 1;
      saveMailView(viewKey, viewSnapshot.current);
    },
    [viewKey]
  );

  const persist = useCallback(
    (next: MailDraft[]) => {
      draftsRef.current = next;
      setDrafts(next);
      let saved = true;
      for (const key of accountKeys) {
        if (
          !writeDrafts(
            key,
            next.filter((draft) => draft.accountKey === key)
          )
        )
          saved = false;
      }
      setStorageFailed(!saved);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accountKey]
  );

  const updateDraft = (next: MailDraft) => {
    const updated = { ...next, updatedAt: new Date().toISOString() };
    setActiveDraft(updated);
    if (accountKeys.includes(updated.accountKey))
      persist([updated, ...draftsRef.current.filter((item) => item.id !== updated.id)]);
    else {
      const saved = readDraftsWithStatus(updated.accountKey);
      setStorageFailed(
        !writeDrafts(updated.accountKey, [
          updated,
          ...saved.drafts.filter((item) => item.id !== updated.id),
        ])
      );
    }
  };
  const beginDraft = (mode: DraftMode) => {
    const owningAccount =
      mode !== "compose" && message?.mailAccount
        ? accounts.find(
            (entry) =>
              entry.connection.account.id === message.mailAccount?.id &&
              entry.connector.id === message.mailAccount?.provider
          )
        : all
          ? accounts.find((entry) => entry.status !== "error")
          : draftAccounts[0];
    if (!owningAccount || owningAccount.status === "error") {
      setDeliveryError("Connect a mailbox before writing a message.");
      return;
    }
    const source = message ? { ...message, id: message.sourceMessageId ?? message.id } : undefined;
    const next = createDraft(mode, source, owningAccount.connection.account);
    next.accountKey = draftKey(owningAccount);
    updateDraft(next);
    setNotice(null);
  };
  const finishDraft = (delivered: boolean, id = activeDraft?.id, storageSaved = true) => {
    if (delivered && !demo) {
      const saved = readScopedDrafts();
      const next =
        saved.status === "ok" ? saved.drafts : draftsRef.current.filter((item) => item.id !== id);
      draftsRef.current = next;
      setDrafts(next);
      setStorageFailed(!storageSaved || saved.status !== "ok");
    } else if (id) {
      const key = activeDraft?.accountKey;
      if (key && !accountKeys.includes(key)) {
        const saved = readDraftsWithStatus(key);
        setStorageFailed(
          !writeDrafts(
            key,
            saved.drafts.filter((item) => item.id !== id)
          )
        );
      } else persist(draftsRef.current.filter((item) => item.id !== id));
    }
    setActiveDraft((current) => (current?.id === id ? null : current));
    if (delivered) {
      setNotice(demo ? "Preview send complete. No email was sent." : "Message sent.");
      void loadFolder();
    }
  };
  const finishDraftRef = useRef(finishDraft);
  finishDraftRef.current = finishDraft;
  const changeDraftAccount = (id: string) => {
    const target = accounts.find((entry) => entry.id === id);
    if (
      !activeDraft ||
      activeDraft.mode !== "compose" ||
      !target ||
      target.status === "error" ||
      isDraftSending(activeDraft.accountKey, activeDraft.id)
    )
      return;
    const nextKey = draftKey(target);
    if (nextKey === activeDraft.accountKey) return;
    const old = readDraftsWithStatus(activeDraft.accountKey);
    const targetSaved = readDraftsWithStatus(nextKey);
    const moved = { ...activeDraft, accountKey: nextKey, updatedAt: new Date().toISOString() };
    if (
      old.status !== "ok" ||
      targetSaved.status !== "ok" ||
      !writeDrafts(nextKey, [moved, ...targetSaved.drafts.filter((draft) => draft.id !== moved.id)])
    ) {
      setDeliveryError("The draft's account could not be changed. Keep a copy and try again.");
      return;
    }
    const removed = writeDrafts(
      activeDraft.accountKey,
      old.drafts.filter((draft) => draft.id !== moved.id)
    );
    if (!removed) {
      writeDrafts(nextKey, targetSaved.drafts);
      setDeliveryError("The draft's account could not be changed. The original draft is kept.");
      return;
    }
    const saved = readScopedDrafts();
    draftsRef.current = saved.drafts;
    setDrafts(saved.drafts);
    setActiveDraft(moved);
  };

  const localQuery = local ? query : "";
  const localUnread = local ? unreadOnly : false;
  const loadFolder = useCallback(async () => {
    if (!folderId) return;
    const request = ++folderRequest.current;
    setLoading(true);
    setError(null);
    setMoreError(null);
    setLoadingMore(false);
    try {
      const result = local
        ? await local.search(searchAllSaved ? undefined : folderId, localQuery, localUnread)
        : await connector.listMessages(folderId);
      if (request === folderRequest.current) setPage(result);
    } catch (cause) {
      if (request === folderRequest.current) setError(errorMessage(cause));
    } finally {
      if (request === folderRequest.current) setLoading(false);
    }
  }, [connector, folderId, local, localQuery, localUnread, searchAllSaved]);
  const loadFolderRef = useRef(loadFolder);
  loadFolderRef.current = loadFolder;

  useEffect(() => {
    if (!local || !folderId) return;
    let cancelled = false;
    const changed = () => {
      if (cancelled) return;
      const status = local.getStatus(folderId);
      setLocalStatus(status);
      void loadFolderRef.current();
      const owner = currentMessageRef.current?.mailAccount;
      const account =
        owner &&
        accounts.find(
          (entry) =>
            entry.connection.account.id === owner.id &&
            entry.connection.account.provider === owner.provider
        );
      const ownerFolder = account?.connection.folders.find((folder) => folder.kind === "inbox")?.id;
      const ownerStatus =
        account?.connector.local && ownerFolder
          ? account.connector.local.getStatus(ownerFolder)
          : status;
      if (ownerStatus.message === "Saved mail cleared.") {
        clearedMessage.current = currentMessageId.current;
        messageRequest.current += 1;
        setMessage(null);
        setMessageError("Saved mail was cleared. Sync this folder to read its messages again.");
      } else if (clearedMessage.current !== currentMessageId.current || !clearedMessage.current)
        setMessageRefresh((value) => value + 1);
    };
    setLocalStatus(local.getStatus(folderId));
    const unsubscribe = local.subscribe(changed);
    // Only the initial list read starts autosync. Store notifications read locally.
    void connector
      .listMessages(folderId)
      .then(changed)
      .catch((cause) => {
        if (!cancelled) setError(errorMessage(cause));
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [connector, local, folderId, accounts]);

  const refreshMessages = async () => {
    if (!local || !folderId) {
      await loadFolder();
      return;
    }
    try {
      await local.synchronize(folderId);
      clearedMessage.current = null;
      setMessageRefresh((value) => value + 1);
      await loadFolderRef.current();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  useEffect(() => {
    if (previousFolder.current !== folderId) {
      setPage(null);
      setQuery("");
      setUnreadOnly(false);
      setLocalDrafts(false);
      previousFolder.current = folderId;
    }
    void loadFolder();
    return () => {
      folderRequest.current += 1;
    };
  }, [loadFolder, folderId]);

  useEffect(() => {
    let cancelled = false;
    const request = ++messageRequest.current;
    setMessage(null);
    setMessageError(null);
    if (previousMessage.current !== messageId) {
      setActiveDraft(null);
      previousMessage.current = messageId;
    }
    if (!messageId) return;
    if (clearedMessage.current === messageId) {
      setMessageError("Saved mail was cleared. Sync this folder to read its messages again.");
      return;
    }
    connector
      .getMessage(messageId)
      .then((item) => {
        if (!cancelled && request === messageRequest.current) setMessage(item);
      })
      .catch((cause) => {
        if (!cancelled && request === messageRequest.current) setMessageError(errorMessage(cause));
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
      const next = local
        ? await local.search(
            searchAllSaved ? undefined : folderId,
            query,
            unreadOnly,
            page.nextPageUrl
          )
        : await connector.listMessages(folderId, page.nextPageUrl);
      if (request !== folderRequest.current) return;
      setPage((current) =>
        current
          ? {
              messages: all
                ? sortMailMessages([...current.messages, ...next.messages])
                : [...current.messages, ...next.messages],
              nextPageUrl: next.nextPageUrl,
              accountWarnings: [
                ...(current.accountWarnings ?? []),
                ...(next.accountWarnings ?? []),
              ],
            }
          : next
      );
    } catch (cause) {
      if (request === folderRequest.current) setMoreError(errorMessage(cause));
    } finally {
      if (request === folderRequest.current) setLoadingMore(false);
    }
  };

  const folder = connection.folders.find((item) => item.id === folderId);
  const folderHref = mailHref({
    demo,
    preview,
    local: searchParams?.get("local") === "1",
    accountId: accountParam,
    folder: folderId,
  });
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered =
    (local
      ? page?.messages
      : page?.messages.filter(
          (item) =>
            (!unreadOnly || !item.isRead) &&
            (!normalizedQuery ||
              [item.from, item.subject, item.preview]
                .join(" ")
                .toLocaleLowerCase()
                .includes(normalizedQuery))
        )) ?? [];
  const showingDraft = Boolean(activeDraft);
  const composerAccount = activeDraft
    ? accounts.find((entry) => draftKey(entry) === activeDraft.accountKey)
    : undefined;
  useEffect(() => {
    if (page && listScrollRef.current && !listRestored.current) {
      listScrollRef.current.scrollTop = savedView.current?.listScroll ?? 0;
      listRestored.current = true;
    }
  }, [page]);
  useEffect(() => {
    if (message && detailScrollRef.current && !detailRestored.current) {
      detailScrollRef.current.scrollTop = savedView.current?.detailScroll ?? 0;
      detailRestored.current = true;
    }
  }, [message]);

  return (
    <div
      className={`${styles.page} ${styles.workbenchPage}${embedded ? ` ${styles.embedded}` : ""}`}
      data-mail-demo={demo ? "true" : "false"}
    >
      <header className={styles.workbenchHeader}>
        <div className={styles.workbenchIdentity}>
          <h1>Mail</h1>
          {accountControl ?? (
            <span className={styles.accountLabel}>{connection.account.address}</span>
          )}
          {demo && (
            <span className={styles.demoBadge}>{preview ? "Brand preview" : "Sample inbox"}</span>
          )}
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
            preview={preview}
            local={searchParams?.get("local") === "1"}
            accountId={accountParam}
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
              savedMail={Boolean(local)}
            />
            <MailListHeader
              folderName={localDrafts ? "Local drafts" : (folder?.name ?? "Inbox")}
              count={localDrafts ? drafts.length : page?.messages.length}
              disabled={loading || loadingMore || localStatus?.phase === "syncing"}
              onRefresh={() => void refreshMessages()}
              localDrafts={localDrafts}
              savedMail={Boolean(local)}
              searchAllSaved={searchAllSaved}
              onSearchScopeChange={setSearchAllSaved}
            />
            <div
              className={styles.listScroll}
              data-testid="mail-message-list"
              ref={listScrollRef}
              onScroll={(event) => {
                viewSnapshot.current.listScroll = event.currentTarget.scrollTop;
              }}
            >
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
                    onRetryFolder={() => void refreshMessages()}
                    onRetryMore={() => void loadMore()}
                  />
                  <MailMessageList
                    loading={loading}
                    loadingMore={loadingMore}
                    hasPage={Boolean(page)}
                    error={error}
                    hasMessages={
                      Boolean(page?.messages.length) || Boolean(local && (query || unreadOnly))
                    }
                    hasMore={Boolean(page?.nextPageUrl)}
                    filtered={filtered}
                    selectedId={messageId}
                    folderHref={folderHref}
                    onClearFilters={() => {
                      setQuery("");
                      setUnreadOnly(false);
                    }}
                    onLoadMore={() => void loadMore()}
                    emptyCopy={
                      localStatus?.phase === "offline" && !localStatus.count
                        ? "This folder has not been saved yet. Connect and sync to read it offline."
                        : undefined
                    }
                  />
                </>
              )}
            </div>
            <div className={styles.listFootnote}>
              {local && !localDrafts && localStatus && (
                <div
                  className={styles.localSyncStatus}
                  role="status"
                  data-testid="mail-local-status"
                  data-phase={localStatus.phase}
                >
                  <span>
                    {localStatus.phase === "syncing"
                      ? "Syncing"
                      : localStatus.phase === "offline"
                        ? "Offline"
                        : localStatus.phase === "error"
                          ? "Sync paused"
                          : "Saved on this browser"}{" "}
                    · {localStatus.count} saved
                  </span>
                  {localStatus.lastSyncedAt && (
                    <span>
                      Last synced{" "}
                      {new Date(localStatus.lastSyncedAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                  {localStatus.message && <span>{localStatus.message}</span>}
                </div>
              )}
              {localDrafts
                ? "Saved on this browser · not synced"
                : demo
                  ? preview
                    ? "Illustrative brand messages · no account connected"
                    : "Example messages · no account connected"
                  : local
                    ? "Plain text only · attachments need a connection"
                    : `${connector.label} · ${all ? "Combined inbox" : "Read access"}`}
            </div>
          </section>
          <section
            className={styles.readPane}
            aria-label="Message preview"
            data-testid="mail-message-detail"
            data-draft-open={Boolean(activeDraft)}
            ref={detailScrollRef}
            onScroll={(event) => {
              viewSnapshot.current.detailScroll = event.currentTarget.scrollTop;
            }}
          >
            {connectionNotice && (
              <p className={styles.deliveryNotice} role="status">
                {connectionNotice}
              </p>
            )}
            {!!page?.accountWarnings?.length && (
              <p className={styles.deliveryNotice} role="status">
                {page.accountWarnings
                  .map((warning) => `${warning.address}: ${warning.message}`)
                  .join(" ")}
                <button
                  type="button"
                  className={styles.textButton}
                  onClick={() => void loadFolder()}
                >
                  Try again
                </button>
              </p>
            )}
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
              <div className={styles.conversation}>
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
              </div>
            )}
            {activeDraft && composerAccount ? (
              <MailComposer
                key={`${activeDraft.accountKey}:${activeDraft.id}`}
                draft={activeDraft}
                accountAddress={composerAccount.connection.account.address}
                connector={composerAccount.connector}
                fromControl={
                  activeDraft.mode === "compose" && accounts.length > 1
                    ? (disabled) => (
                        <MailFromPicker
                          accounts={accounts}
                          selectedId={composerAccount.id}
                          disabled={disabled}
                          onSelect={changeDraftAccount}
                        />
                      )
                    : undefined
                }
                demo={demo}
                sendingEnabled={sendingAccounts.has(activeDraft.accountKey)}
                onSendingEnabled={() =>
                  setSendingAccounts((current) => new Set(current).add(activeDraft.accountKey))
                }
                onChange={updateDraft}
                storageFailed={storageFailed}
                onClose={() => setActiveDraft(null)}
                onDiscard={() => finishDraft(false)}
                onSent={(storageSaved) =>
                  finishDraftRef.current(true, activeDraft.id, storageSaved)
                }
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
