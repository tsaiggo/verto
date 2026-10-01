"use client";
import Link from "./MailViewLink";
import { Mail, Paperclip, RefreshCw, Search } from "lucide-react";
import { mailSender } from "@/lib/mail/addresses";
import { Button } from "@/components/ui/button";
import type { MailMessageSummary } from "@/lib/mail/model";
import MailSenderAvatar from "./MailSenderAvatar";
import styles from "./MailWorkspace.module.css";
export default function MailMessageList({
  loading,
  loadingMore,
  hasPage,
  error,
  hasMessages,
  hasMore,
  filtered,
  selectedId,
  folderHref,
  onClearFilters,
  onLoadMore,
  emptyCopy,
}: {
  loading: boolean;
  loadingMore: boolean;
  hasPage: boolean;
  error: string | null;
  hasMessages: boolean;
  hasMore: boolean;
  filtered: MailMessageSummary[];
  selectedId: string | null;
  folderHref: string;
  onClearFilters: () => void;
  onLoadMore: () => void;
  emptyCopy?: string;
}) {
  return (
    <>
      {loading && !hasPage ? null : error && !hasPage ? null : hasMessages ? (
        <>
          {filtered.length ? (
            <ul className={styles.messageList}>
              {filtered.map((item) => (
                <MessageRow
                  key={item.id}
                  item={item}
                  folderHref={folderHref}
                  selected={item.id === selectedId}
                />
              ))}
            </ul>
          ) : (
            <div className={styles.empty} role="status">
              <h3>No matching messages</h3>
              <p>Try another search or include read messages.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClearFilters();
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
          {hasMore && (
            <button
              type="button"
              className={styles.moreButton}
              disabled={loading || loadingMore}
              onClick={onLoadMore}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      ) : (
        <div className={styles.empty} role="status">
          <Mail aria-hidden />
          <h3>{emptyCopy ? "No saved messages in this folder" : "No messages in this folder."}</h3>
          <p>{emptyCopy ?? "Refresh to check for new mail."}</p>
        </div>
      )}
    </>
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
        className={`${styles.messageRow} ${styles.senderRow}${selected ? ` ${styles.selected}` : ""}${item.isRead ? "" : ` ${styles.unread}`}`}
        aria-current={selected ? "true" : undefined}
      >
        <span
          className={styles.unreadDot}
          data-unread={!item.isRead}
          aria-label={item.isRead ? "Read" : "Unread"}
        />
        <MailSenderAvatar from={item.from} compact />
        <span className={styles.rowContent}>
          <span className={styles.rowTop}>
            <strong>{mailSender(item.from).name || item.from}</strong>
            <time dateTime={item.receivedAt}>
              {new Date(item.receivedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </time>
          </span>
          <span className={styles.subject}>
            <span className={styles.subjectText}>{item.subject || "(No subject)"}</span>
            {item.hasAttachments && <Paperclip aria-label="Has attachments" />}
          </span>
          {item.mailAccount ? (
            <span className={styles.messageAccount} title={item.mailAccount.address}>
              {item.mailAccount.provider === "google" ? "Gmail" : "Outlook"} ·{" "}
              {item.mailAccount.address}
            </span>
          ) : (
            <span className={styles.preview}>{item.preview}</span>
          )}
        </span>
      </Link>
    </li>
  );
}

export function MailMessageFilters({
  query,
  unreadOnly,
  onQueryChange,
  onUnreadToggle,
  localDrafts = false,
  savedMail = false,
}: {
  query: string;
  unreadOnly: boolean;
  onQueryChange: (query: string) => void;
  onUnreadToggle: () => void;
  localDrafts?: boolean;
  savedMail?: boolean;
}) {
  return (
    <div className={styles.listFilters}>
      <label className={styles.search}>
        <Search aria-hidden />
        <input
          type="search"
          aria-label={
            localDrafts
              ? "Search local drafts"
              : savedMail
                ? "Search saved mail"
                : "Search loaded messages"
          }
          placeholder={
            localDrafts ? "Search drafts" : savedMail ? "Search saved mail" : "Search this inbox"
          }
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      {!localDrafts && (
        <button
          type="button"
          className={`${styles.filterButton}${unreadOnly ? ` ${styles.activeFilter}` : ""}`}
          aria-pressed={unreadOnly}
          onClick={onUnreadToggle}
        >
          Unread
        </button>
      )}
    </div>
  );
}

export function MailListHeader({
  folderName,
  count,
  disabled,
  onRefresh,
  localDrafts = false,
  savedMail = false,
  searchAllSaved = false,
  onSearchScopeChange,
}: {
  folderName: string;
  count: number | undefined;
  disabled: boolean;
  onRefresh: () => void;
  localDrafts?: boolean;
  savedMail?: boolean;
  searchAllSaved?: boolean;
  onSearchScopeChange?: (all: boolean) => void;
}) {
  return (
    <header className={styles.listHeader}>
      <div>
        {savedMail && !localDrafts ? (
          <select
            className={styles.searchScope}
            aria-label="Saved mail search scope"
            value={searchAllSaved ? "all" : "folder"}
            onChange={(event) => onSearchScopeChange?.(event.target.value === "all")}
          >
            <option value="folder">{folderName}</option>
            <option value="all">All saved mail</option>
          </select>
        ) : (
          <h2>{folderName}</h2>
        )}
        <p>
          {typeof count === "number"
            ? `${count} ${localDrafts ? "saved" : savedMail ? "shown" : "loaded"}`
            : "Mailbox"}
        </p>
      </div>
      {!localDrafts && (
        <button
          type="button"
          className={styles.iconButton}
          aria-label={savedMail ? "Sync saved mail" : "Refresh messages"}
          title={savedMail ? "Sync saved mail" : "Refresh messages"}
          disabled={disabled}
          onClick={onRefresh}
        >
          <RefreshCw aria-hidden="true" />
        </button>
      )}
    </header>
  );
}
