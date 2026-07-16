"use client";

import Link from "next/link";
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  BookOpen,
  CheckCheck,
  ExternalLink,
  Mail,
  Newspaper,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  deleteInboxItem,
  loadInbox,
  setInboxStatus,
  subscribeInbox,
  type InboxItem,
  type InboxState,
  type InboxStatus,
} from "@/lib/inbox";
import { formatDate } from "@/lib/format";
import InboxArticlePreview from "@/components/inbox/InboxArticlePreview";
import SubscriptionManager from "@/components/inbox/SubscriptionManager";
import { useOnboardingReturn } from "@/components/integrations/use-onboarding-return";
import { ContentHeader, ContentPage } from "@/components/layout/ContentPage";
import ContentTabs, { contentTabId } from "@/components/layout/ContentTabs";
import { ContentEmptyState, ContentRow } from "@/components/ui/content-primitives";
import { Button } from "@/components/ui/button";
import styles from "@/components/inbox/InboxView.module.css";

function getSnapshot(): string {
  return JSON.stringify(loadInbox());
}

function getServerSnapshot(): string {
  return JSON.stringify({ items: [] });
}

type TabFilter = "all" | "unread" | "read" | "archived";

const TABS: ReadonlyArray<{ id: TabFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "read", label: "Read" },
  { id: "archived", label: "Archived" },
];

const INBOX_TABS_ID = "inbox-filter-tabs";
const INBOX_PANEL_ID = "inbox-items-panel";

function matchesTab(item: InboxItem, tab: TabFilter): boolean {
  switch (tab) {
    case "all":
      return item.status !== "archived";
    case "unread":
      return item.status === "unread" || item.status === "reading";
    case "read":
      return item.status === "read";
    case "archived":
      return item.status === "archived";
  }
}

const STATUS_LABELS: Record<InboxStatus, string> = {
  unread: "Unread",
  reading: "Reading",
  read: "Read",
  archived: "Archived",
};

function StatusBadge({ status }: { status: InboxStatus }) {
  return (
    <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

interface InboxItemActionsProps {
  item: InboxItem;
  onStatusChange: (id: string, status: InboxStatus) => void;
  onDelete: (id: string, title: string) => void;
}

function InboxItemActions({ item, onStatusChange, onDelete }: InboxItemActionsProps) {
  const action = (
    hrefOrAction:
      | { href: string; label: string; icon: React.ReactNode }
      | { onClick: () => void; label: string; icon: React.ReactNode; destructive?: boolean }
  ) => {
    if ("href" in hrefOrAction) {
      return (
        <a
          className={styles.itemAction}
          href={hrefOrAction.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${hrefOrAction.label}: ${item.title}`}
          title={hrefOrAction.label}
        >
          {hrefOrAction.icon}
        </a>
      );
    }
    return (
      <button
        type="button"
        className={`${styles.itemAction}${hrefOrAction.destructive ? ` ${styles.destructiveAction}` : ""}`}
        aria-label={hrefOrAction.label}
        title={hrefOrAction.label}
        onClick={hrefOrAction.onClick}
      >
        {hrefOrAction.icon}
      </button>
    );
  };

  return (
    <div className={styles.itemActions}>
      {action({
        href: item.url,
        label: "Open original article",
        icon: <ExternalLink aria-hidden />,
      })}
      {item.status === "unread" || item.status === "reading"
        ? action({
            label: "Mark as read",
            onClick: () => onStatusChange(item.id, "read"),
            icon: <CheckCheck aria-hidden />,
          })
        : item.status === "read"
          ? action({
              label: "Mark as unread",
              onClick: () => onStatusChange(item.id, "unread"),
              icon: <Mail aria-hidden />,
            })
          : action({
              label: "Restore to inbox",
              onClick: () => onStatusChange(item.id, "unread"),
              icon: <RotateCcw aria-hidden />,
            })}
      {item.status === "archived"
        ? action({
            label: `Delete ${item.title} from inbox`,
            onClick: () => onDelete(item.id, item.title),
            icon: <Trash2 aria-hidden />,
            destructive: true,
          })
        : action({
            label: "Archive",
            onClick: () => onStatusChange(item.id, "archived"),
            icon: <Archive aria-hidden />,
          })}
    </div>
  );
}

function itemMetadata(item: InboxItem): string {
  return [item.sourceName, item.author, item.publishedAt ? formatDate(item.publishedAt) : null]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

function InboxRow({
  item,
  onPreview,
  onStatusChange,
  onDelete,
}: {
  item: InboxItem;
  onPreview: (item: InboxItem) => void;
  onStatusChange: (id: string, status: InboxStatus) => void;
  onDelete: (id: string, title: string) => void;
}) {
  const metadata = itemMetadata(item);
  return (
    <li>
      <ContentRow
        className={styles.itemRow}
        leading={<BookOpen aria-hidden />}
        title={
          <span className={styles.itemTitleLine}>
            <button
              type="button"
              className={styles.itemTitle}
              aria-label={`Preview ${item.title}`}
              onClick={() => onPreview(item)}
            >
              {item.title}
            </button>
            <StatusBadge status={item.status} />
          </span>
        }
        description={
          <span className={styles.itemDescription}>
            {metadata ? <span>{metadata}</span> : null}
            {item.summary ? <span>{item.summary}</span> : null}
          </span>
        }
        actions={
          <InboxItemActions item={item} onStatusChange={onStatusChange} onDelete={onDelete} />
        }
      />
    </li>
  );
}

function InboxEmpty({ tab }: { tab: TabFilter }) {
  const title = tab === "all" ? "Your inbox is empty" : `No ${tab} items`;
  const description =
    tab === "all"
      ? "Add a subscription to start receiving articles."
      : "Items will appear here when their status matches this filter.";
  return (
    <ContentEmptyState
      compact
      icon={<Newspaper aria-hidden />}
      title={title}
      description={description}
      action={
        tab === "all" ? (
          <a className={styles.emptyAction} href="#subscriptions">
            Add your first feed
            <ArrowDown aria-hidden />
          </a>
        ) : undefined
      }
    />
  );
}

export default function InboxView() {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [previewedItemId, setPreviewedItemId] = useState<string | null>(null);
  const isOnboardingReturn = useOnboardingReturn();
  const snapshot = useSyncExternalStore(subscribeInbox, getSnapshot, getServerSnapshot);
  const { items } = JSON.parse(snapshot) as InboxState;
  const filtered = items.filter((item) => matchesTab(item, activeTab));
  const previewedItem = items.find((item) => item.id === previewedItemId) ?? null;
  const tabs = TABS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    count: items.filter((item) => matchesTab(item, tab.id)).length,
    panelId: INBOX_PANEL_ID,
  }));

  function persist(action: () => void, failure: string) {
    try {
      action();
    } catch {
      toast.error(failure, { description: "Check that local storage is available, then retry." });
    }
  }

  function previewItem(item: InboxItem) {
    if (item.status === "unread") {
      persist(() => setInboxStatus(item.id, "reading"), "Couldn't save reading status");
    }
    setPreviewedItemId(item.id);
  }

  function changeStatus(id: string, status: InboxStatus) {
    persist(() => setInboxStatus(id, status), "Couldn't update this article");
  }

  function removeItem(id: string, title: string) {
    persist(() => deleteInboxItem(id), `Couldn't delete ${title}`);
  }

  return (
    <ContentPage width="standard" className={styles.page}>
      <ContentHeader
        title="Inbox"
        description="Review articles collected from your subscriptions."
        meta={`${items.length} ${items.length === 1 ? "article" : "articles"}`}
        actions={
          isOnboardingReturn ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/onboarding/source">
                <ArrowLeft aria-hidden />
                Back to setup
              </Link>
            </Button>
          ) : undefined
        }
      />

      <ContentTabs
        id={INBOX_TABS_ID}
        items={tabs}
        value={activeTab}
        onValueChange={setActiveTab}
        label="Inbox filters"
      />

      <section
        id={INBOX_PANEL_ID}
        role="tabpanel"
        aria-labelledby={contentTabId(INBOX_TABS_ID, activeTab)}
        className={styles.itemsPanel}
        tabIndex={0}
      >
        {filtered.length > 0 ? (
          <ul className={styles.itemList}>
            {filtered.map((item) => (
              <InboxRow
                key={item.id}
                item={item}
                onPreview={previewItem}
                onStatusChange={changeStatus}
                onDelete={removeItem}
              />
            ))}
          </ul>
        ) : (
          <InboxEmpty tab={activeTab} />
        )}
      </section>

      <div id="subscriptions" className={styles.subscriptionsAnchor}>
        <SubscriptionManager />
      </div>

      <InboxArticlePreview
        item={previewedItem}
        open={previewedItem !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewedItemId(null);
        }}
      />
    </ContentPage>
  );
}
