"use client";

import Link from "next/link";
import { ArrowLeft, Newspaper, Plus } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  loadInbox,
  setInboxStatus,
  subscribeInbox,
  type InboxItem,
  type InboxState,
} from "@/lib/inbox";
import {
  loadSubscriptions,
  subscribeSubscriptions,
  type SubscriptionsState,
} from "@/lib/subscriptions";
import InboxArticlePreview from "@/components/inbox/InboxArticlePreview";
import SubscriptionManager from "@/components/inbox/SubscriptionManager";
import { useOnboardingReturn } from "@/components/integrations/use-onboarding-return";
import PageFrame from "@/components/layout/PageFrame";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { InboxEmpty, InboxItemActions, InboxRow } from "./InboxRows";
import { InboxFilters, InboxToolbar, matchesTab, type TabFilter } from "./InboxControls";
import styles from "./InboxView.module.css";

const getSnapshot = () => JSON.stringify(loadInbox());
const getServerSnapshot = () => JSON.stringify({ items: [] });
const getSubscriptionsSnapshot = () => JSON.stringify(loadSubscriptions());
const getSubscriptionsServerSnapshot = () => JSON.stringify({ subscriptions: [] });

export default function InboxView() {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [previewedItemId, setPreviewedItemId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [feedsOpen, setFeedsOpen] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const isOnboardingReturn = useOnboardingReturn();
  const snapshot = useSyncExternalStore(subscribeInbox, getSnapshot, getServerSnapshot);
  const subscriptionsSnapshot = useSyncExternalStore(
    subscribeSubscriptions,
    getSubscriptionsSnapshot,
    getSubscriptionsServerSnapshot
  );
  const { items } = JSON.parse(snapshot) as InboxState;
  const { subscriptions } = JSON.parse(subscriptionsSnapshot) as SubscriptionsState;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = items.filter(
    (item) =>
      matchesTab(item, activeTab) &&
      (!source || item.feedUrl === source) &&
      (!normalizedQuery ||
        [item.title, item.sourceName, item.author, item.summary]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedQuery))
  );
  const previewedItem = items.find((item) => item.id === previewedItemId) ?? null;
  const sources = Array.from(
    new Map(
      items.map((item) => [item.feedUrl, item.sourceName || new URL(item.feedUrl).hostname])
    ).entries()
  );

  function openFeeds() {
    setFeedsOpen(true);
    requestAnimationFrame(() => document.getElementById("subscription-feed-url")?.focus());
  }

  useEffect(() => {
    function followSetupLink() {
      if (window.location.hash !== "#subscriptions") return;
      requestAnimationFrame(() => {
        setFeedsOpen(true);
        requestAnimationFrame(() => document.getElementById("subscription-feed-url")?.focus());
      });
    }
    followSetupLink();
    window.addEventListener("hashchange", followSetupLink);
    return () => window.removeEventListener("hashchange", followSetupLink);
  }, []);

  function previewItem(item: InboxItem) {
    if (item.status === "unread") setInboxStatus(item.id, "reading");
    setPreviewedItemId(item.id);
  }

  function closePreview() {
    const previousId = previewedItemId;
    setPreviewedItemId(null);
    requestAnimationFrame(() => previousId && rowRefs.current.get(previousId)?.focus());
  }

  return (
    <div className={styles.page}>
      <InboxHeader isOnboardingReturn={isOnboardingReturn} onAddFeed={openFeeds} />
      <PageFrame size="wide" className={styles.frame}>
        <InboxToolbar
          items={items}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setPreviewedItemId(null);
          }}
          feedsOpen={feedsOpen}
          onFeedToggle={() => setFeedsOpen(!feedsOpen)}
          subscriptionCount={subscriptions.length}
          failedFeedCount={subscriptions.filter((feed) => feed.lastSyncErrorAt).length}
        />
        <div id="subscriptions" className={styles.subscriptions} hidden={!feedsOpen}>
          <SubscriptionManager />
        </div>
        <InboxFilters
          query={query}
          source={source}
          sources={sources}
          onQueryChange={setQuery}
          onSourceChange={setSource}
        />
        <div className={styles.workspace} data-article-selected={previewedItem ? "true" : "false"}>
          <section
            className={styles.listPane}
            id="inbox-results"
            role="tabpanel"
            aria-labelledby={`inbox-tab-${activeTab}`}
            tabIndex={0}
          >
            <p className={styles.listCount}>
              {filtered.length} {filtered.length === 1 ? "article" : "articles"}
            </p>
            {filtered.length ? (
              <ul className={styles.list}>
                {filtered.map((item) => (
                  <InboxRow
                    key={item.id}
                    item={item}
                    selected={previewedItemId === item.id}
                    onPreview={previewItem}
                    onRef={(node) => {
                      if (node) rowRefs.current.set(item.id, node);
                      else rowRefs.current.delete(item.id);
                    }}
                  />
                ))}
              </ul>
            ) : (
              <InboxEmpty
                tab={activeTab}
                hasFilters={Boolean(normalizedQuery || source)}
                subscriptionCount={subscriptions.length}
                onAddFeed={openFeeds}
                onClearFilters={() => {
                  setQuery("");
                  setSource("");
                }}
              />
            )}
          </section>
          <section className={styles.readPane} aria-label="Article preview">
            {previewedItem ? (
              <InboxArticlePreview
                item={previewedItem}
                onClose={closePreview}
                actions={<InboxItemActions item={previewedItem} />}
              />
            ) : (
              <div className={styles.selectPrompt}>
                <Newspaper aria-hidden />
                <p>Select an article to read.</p>
              </div>
            )}
          </section>
        </div>
      </PageFrame>
    </div>
  );
}

function InboxHeader({
  isOnboardingReturn,
  onAddFeed,
}: {
  isOnboardingReturn: boolean;
  onAddFeed: () => void;
}) {
  return (
    <PageHeader
      title="Inbox"
      subtitle="Articles from your RSS and Atom feeds."
      frame="wide"
      tools={
        <Button size="sm" onClick={onAddFeed}>
          <Plus aria-hidden />
          Add feed
        </Button>
      }
      right={
        isOnboardingReturn ? (
          <Link href="/onboarding/source" className={styles.setupReturn}>
            <ArrowLeft aria-hidden />
            Back to setup
          </Link>
        ) : undefined
      }
    />
  );
}
