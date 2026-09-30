"use client";
import Link from "next/link";
import { Mail, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MailMessageSummary } from "@/lib/mail/model";
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
          <h3>No messages in this folder.</h3>
          <p>Refresh to check for new mail.</p>
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

export function MailMessageFilters({
  query,
  unreadOnly,
  onQueryChange,
  onUnreadToggle,
}: {
  query: string;
  unreadOnly: boolean;
  onQueryChange: (query: string) => void;
  onUnreadToggle: () => void;
}) {
  return (
    <div className={styles.listFilters}>
      <label className={styles.search}>
        <Search aria-hidden />
        <input
          type="search"
          aria-label="Search loaded messages"
          placeholder="Search loaded messages"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      <button
        type="button"
        className={`${styles.filterButton}${unreadOnly ? ` ${styles.activeFilter}` : ""}`}
        aria-pressed={unreadOnly}
        onClick={onUnreadToggle}
      >
        Unread
      </button>
    </div>
  );
}

export function MailListHeader({
  folderName,
  count,
  disabled,
  onRefresh,
}: {
  folderName: string;
  count: number | undefined;
  disabled: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className={styles.listHeader}>
      <div>
        <h2>{folderName}</h2>
        <p>{typeof count === "number" ? `${count} loaded` : "Read-only mailbox"}</p>
      </div>
      <button type="button" className={styles.quietButton} disabled={disabled} onClick={onRefresh}>
        <RefreshCw aria-hidden="true" /> Refresh
      </button>
    </header>
  );
}
