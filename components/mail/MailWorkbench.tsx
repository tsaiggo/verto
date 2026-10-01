"use client";

import Link, { navigateMailView } from "./MailViewLink";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, FilePenLine, Plus, Unplug } from "lucide-react";
import type {
  MailConnection,
  MailConnector,
  MailMessage,
  MailMessageAction,
  MailMutationResult,
  MailPage,
} from "@/lib/mail/model";
import type { LocalMailStatus } from "@/lib/mail/local-types";
import {
  createDraft,
  mailAccountKey,
  moveMailDraft,
  readDraftsWithStatus,
  removeMailDraft,
  saveMailDraft,
  subscribeDraftChanges,
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
  onRetryConnection,
  retryingConnection,
  onConnectionChanged,
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
  onRetryConnection?: () => void;
  retryingConnection?: boolean;
  onConnectionChanged?: (id: string, connector: MailConnector, connection: MailConnection) => void;
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
  const unsavedDrafts = useRef(new Map<string, MailDraft>());
  const draftSaveJobs = useRef(new Map<string, Promise<boolean>>());
  const [activeDraft, setActiveDraft] = useState<MailDraft | null>(null);
  const [localDrafts, setLocalDrafts] = useState(savedView.current?.localDrafts ?? false);
  const mutationView = JSON.stringify([viewKey, folderId, localDrafts, searchAllSaved]);
  const currentMutationView = useRef(mutationView);
  currentMutationView.current = mutationView;
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
    const recovered = saved.flatMap((entry) => entry.drafts);
    for (const draft of unsavedDrafts.current.values()) {
      if (!accountKeys.includes(draft.accountKey)) continue;
      const index = recovered.findIndex(
        (item) => item.id === draft.id && item.accountKey === draft.accountKey
      );
      if (index >= 0) recovered[index] = draft;
      else recovered.push(draft);
    }
    return {
      drafts: recovered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
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
    const unsubscribe = subscribeDraftChanges(() => {
      const latest = readScopedDrafts();
      draftsRef.current = latest.drafts;
      setDrafts(latest.drafts);
      // An external save refreshes the list while the active editor keeps its current text.
    });
    const leaving = (event: BeforeUnloadEvent) => {
      if (!unsavedDrafts.current.size) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", leaving);
    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", leaving);
    };
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

  const updateDraft = (next: MailDraft, create = false) => {
    const updated = { ...next, updatedAt: new Date().toISOString() };
    setActiveDraft(updated);
    const identity = JSON.stringify([updated.accountKey, updated.id]);
    unsavedDrafts.current.set(identity, updated);
    const visible = readScopedDrafts();
    draftsRef.current = visible.drafts;
    setDrafts(visible.drafts);
    const generation = lifetime.current;
    const job = saveMailDraft(updated, create);
    draftSaveJobs.current.set(identity, job);
    void job.then((saved) => {
      if (draftSaveJobs.current.get(identity) === job) draftSaveJobs.current.delete(identity);
      if (saved && unsavedDrafts.current.get(identity) === updated)
        unsavedDrafts.current.delete(identity);
      if (generation !== lifetime.current) return;
      const latest = readScopedDrafts();
      draftsRef.current = latest.drafts;
      setDrafts(latest.drafts);
      setStorageFailed(!saved || unsavedDrafts.current.size > 0);
    });
  };
  const closeDraft = async () => {
    if (!activeDraft) return;
    const { accountKey: owner, id } = activeDraft;
    const identity = JSON.stringify([owner, id]);
    const generation = lifetime.current;
    await draftSaveJobs.current.get(identity);
    if (generation !== lifetime.current) return;
    if (unsavedDrafts.current.has(identity)) {
      setStorageFailed(true);
      return;
    }
    setActiveDraft((current) =>
      current?.id === id && current.accountKey === owner ? null : current
    );
  };
  const prepareDraftSend = async (draft: MailDraft) => {
    const identity = JSON.stringify([draft.accountKey, draft.id]);
    await draftSaveJobs.current.get(identity);
    if (unsavedDrafts.current.has(identity))
      throw new Error("This draft could not be saved. Keep a copy and try saving again.");
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
    updateDraft(next, true);
    setNotice(null);
  };
  const discardDraft = async (id: string) => {
    const key =
      activeDraft?.id === id
        ? activeDraft.accountKey
        : draftsRef.current.find((item) => item.id === id)?.accountKey;
    const generation = lifetime.current;
    const removed = Boolean(key) && (await removeMailDraft(key!, id));
    if (generation !== lifetime.current) return false;
    if (!removed) {
      setStorageFailed(true);
      return false;
    }
    unsavedDrafts.current.delete(JSON.stringify([key, id]));
    const saved = readScopedDrafts();
    draftsRef.current = saved.drafts;
    setDrafts(saved.drafts);
    setStorageFailed(unsavedDrafts.current.size > 0);
    return true;
  };
  const finishDraft = async (delivered: boolean, id = activeDraft?.id, storageSaved = true) => {
    if (delivered && !demo) {
      const saved = readScopedDrafts();
      const next =
        saved.status === "ok" ? saved.drafts : draftsRef.current.filter((item) => item.id !== id);
      draftsRef.current = next;
      setDrafts(next);
      setStorageFailed(!storageSaved || saved.status !== "ok");
    } else if (id && !(await discardDraft(id))) return;
    setActiveDraft((current) => (current?.id === id ? null : current));
    if (delivered) {
      setNotice(demo ? "Preview send complete. No email was sent." : "Message sent.");
      void loadFolder();
    }
  };
  const finishDraftRef = useRef(finishDraft);
  finishDraftRef.current = finishDraft;
  const changeDraftAccount = async (id: string) => {
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
    const moved = { ...activeDraft, accountKey: nextKey, updatedAt: new Date().toISOString() };
    const oldKey = activeDraft.accountKey;
    const generation = lifetime.current;
    if (!(await moveMailDraft(moved, oldKey))) {
      setDeliveryError("The draft's account could not be changed. Keep a copy and try again.");
      return;
    }
    unsavedDrafts.current.delete(JSON.stringify([oldKey, moved.id]));
    if (generation !== lifetime.current) return;
    const saved = readScopedDrafts();
    draftsRef.current = saved.drafts;
    setDrafts(saved.drafts);
    setActiveDraft((current) =>
      current?.id === moved.id && current.accountKey === oldKey ? moved : current
    );
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
  const refreshConnections = useCallback(async () => {
    if (!onConnectionChanged) return;
    await Promise.all(
      accounts.map(async (account) => {
        try {
          const latest = account.connector.local?.getConnection
            ? await account.connector.local.getConnection()
            : demo
              ? await account.connector.restore()
              : undefined;
          if (latest) onConnectionChanged(account.id, account.connector, latest);
        } catch {
          // Failure to refresh a count must not discard a confirmed message update.
        }
      })
    );
  }, [accounts, onConnectionChanged, demo]);

  useEffect(() => {
    if (!local || !folderId) return;
    let cancelled = false;
    const changed = () => {
      if (cancelled) return;
      const status = local.getStatus(folderId);
      setLocalStatus(status);
      void refreshConnections();
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
  }, [connector, local, folderId, accounts, refreshConnections]);

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
  const mutationChanged = (
    originalId: string,
    result: MailMutationResult,
    action: MailMessageAction
  ) => {
    void refreshConnections();
    // Old folder, account and message callbacks may settle after navigation.
    if (
      currentMessageId.current !== originalId ||
      currentMutationView.current !== mutationView ||
      !detailScrollRef.current
    )
      return;
    messageRequest.current += 1;
    const stays = searchAllSaved || (folderId && result.folderIds.includes(folderId));
    setPage((current) =>
      current
        ? {
            ...current,
            messages: current.messages.flatMap((item) =>
              item.id === originalId
                ? stays && (!unreadOnly || !result.message.isRead)
                  ? [result.message]
                  : []
                : [item]
            ),
          }
        : current
    );
    setNotice(
      action.type === "archive"
        ? "Message archived."
        : action.type === "trash"
          ? "Message moved to Trash."
          : action.type === "read"
            ? action.value
              ? "Marked read."
              : "Marked unread."
            : action.value
              ? "Message starred."
              : "Star removed."
    );
    if (stays) {
      setMessage(result.message);
      if (result.message.id !== originalId)
        navigateMailView(`${folderHref}&message=${encodeURIComponent(result.message.id)}`, {
          replace: true,
        });
    } else {
      setMessage(null);
      navigateMailView(folderHref, { replace: true });
    }
    void loadFolderRef.current();
  };
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
                {onRetryConnection && (
                  <button
                    type="button"
                    className={styles.textButton}
                    disabled={retryingConnection}
                    onClick={onRetryConnection}
                  >
                    {retryingConnection ? "Retrying…" : "Retry connection"}
                  </button>
                )}
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
                  onChanged={mutationChanged}
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
                onBeforeSend={prepareDraftSend}
                storageFailed={storageFailed}
                onClose={closeDraft}
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
