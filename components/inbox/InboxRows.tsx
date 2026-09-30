"use client";
import {
  Archive,
  CheckCheck,
  ExternalLink,
  Mail,
  Newspaper,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  deleteInboxItem,
  saveInboxItem,
  setInboxStatus,
  type InboxItem,
  type InboxStatus,
} from "@/lib/inbox";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TabFilter } from "./InboxControls";
import styles from "./InboxView.module.css";
const STATUS_LABELS: Record<InboxStatus, string> = {
  unread: "Unread",
  reading: "Reading",
  read: "Read",
  archived: "Archived",
};

function deleteArchivedItem(item: InboxItem) {
  deleteInboxItem(item.id);
  toast("Deleted from inbox", {
    description: item.title,
    action: { label: "Undo", onClick: () => saveInboxItem(item) },
  });
}

export function InboxItemActions({ item }: { item: InboxItem }) {
  const archived = item.status === "archived";
  const read = item.status === "read";
  return (
    <div className={styles.itemActions} aria-label={`Actions for ${item.title}`}>
      <a
        className={styles.iconButton}
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open original article: ${item.title}`}
        title="Open original article"
      >
        <ExternalLink aria-hidden />
      </a>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={archived ? "Restore to inbox" : read ? "Mark as unread" : "Mark as read"}
        title={archived ? "Restore to inbox" : read ? "Mark as unread" : "Mark as read"}
        onClick={() => setInboxStatus(item.id, archived || read ? "unread" : "read")}
      >
        {archived ? (
          <RotateCcw aria-hidden />
        ) : read ? (
          <Mail aria-hidden />
        ) : (
          <CheckCheck aria-hidden />
        )}
      </button>
      <button
        type="button"
        className={`${styles.iconButton}${archived ? ` ${styles.destructive}` : ""}`}
        aria-label={archived ? `Delete ${item.title} from inbox` : "Archive"}
        title={archived ? "Delete from inbox" : "Archive"}
        onClick={() => (archived ? deleteArchivedItem(item) : setInboxStatus(item.id, "archived"))}
      >
        {archived ? <Trash2 aria-hidden /> : <Archive aria-hidden />}
      </button>
    </div>
  );
}

export function InboxEmpty({
  tab,
  hasFilters,
  subscriptionCount,
  onAddFeed,
  onClearFilters,
}: {
  tab: TabFilter;
  hasFilters: boolean;
  subscriptionCount: number;
  onAddFeed: () => void;
  onClearFilters: () => void;
}) {
  return (
    <div className={styles.empty} role="status">
      <Newspaper aria-hidden />
      <h2>
        {hasFilters
          ? "No matching articles"
          : tab === "all"
            ? "Your inbox is empty"
            : `No ${tab} articles`}
      </h2>
      <p>
        {hasFilters
          ? "Try another search or source."
          : tab === "all"
            ? subscriptionCount
              ? "Your feeds have no saved articles yet. Check them in Manage feeds."
              : "Add an RSS or Atom feed to start reading."
            : "Articles appear here when their reading status matches."}
      </p>
      {hasFilters ? (
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      ) : tab === "all" && !subscriptionCount ? (
        <Button variant="outline" size="sm" onClick={onAddFeed}>
          <Plus aria-hidden />
          Add your first feed
        </Button>
      ) : null}
    </div>
  );
}

export function InboxRow({
  item,
  selected,
  onPreview,
  onRef,
}: {
  item: InboxItem;
  selected: boolean;
  onPreview: (item: InboxItem) => void;
  onRef: (node: HTMLButtonElement | null) => void;
}) {
  return (
    <li className={`${styles.item}${selected ? ` ${styles.selectedItem}` : ""}`}>
      <button
        type="button"
        className={styles.row}
        aria-label={`Preview ${item.title}`}
        aria-current={selected ? "true" : undefined}
        ref={onRef}
        onClick={() => onPreview(item)}
      >
        <span className={styles.rowMeta}>
          <span>{item.sourceName || "Feed"}</span>
          {item.publishedAt && (
            <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
          )}
        </span>
        <span className={styles.rowTitle}>{item.title}</span>
        {item.summary && <span className={styles.rowSummary}>{item.summary}</span>}
        <span className={styles.rowStatus}>{STATUS_LABELS[item.status]}</span>
      </button>
      <InboxItemActions item={item} />
    </li>
  );
}
