"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AddToCollectionButton } from "@/components/reader/AddToCollectionButton";
import { formatDate } from "@/lib/format";
import type { InboxItem } from "@/lib/inbox";
import styles from "./InboxView.module.css";

/** A safe, local reading surface for plain text supplied by a feed. */
export default function InboxArticlePreview({
  item,
  onClose,
  actions,
}: {
  item: InboxItem;
  onClose: () => void;
  actions: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const paragraphs = item.content?.split(/\n{2,}/).filter(Boolean) ?? [];
  const meta = [item.author, item.publishedAt ? formatDate(item.publishedAt) : null]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    heading.current?.focus();
  }, [item.id]);

  return (
    <article
      className={styles.article}
      data-testid="inbox-article-preview"
      onKeyDown={(event) => {
        // Portalled collection menus and dialogs own their Escape dismissal.
        if (
          event.key !== "Escape" ||
          event.defaultPrevented ||
          !event.currentTarget.contains(event.target as Node)
        )
          return;
        event.preventDefault();
        onClose();
      }}
    >
      <div className={styles.articleToolbar}>
        <button type="button" className={styles.backButton} onClick={onClose}>
          <ArrowLeft aria-hidden />
          Back to inbox
        </button>
        {actions}
      </div>
      <header className={styles.articleHeader}>
        <p className={styles.articleSource}>{item.sourceName || "Feed article"}</p>
        <h2 ref={heading} tabIndex={-1}>
          {item.title}
        </h2>
        {meta && <p className={styles.articleMeta}>{meta}</p>}
      </header>
      <div className={styles.articleBody}>
        {paragraphs.length ? (
          paragraphs.map((paragraph, index) => <p key={`${item.id}-${index}`}>{paragraph}</p>)
        ) : (
          <>
            <p>{item.summary}</p>
            <p className={styles.articleFallback}>
              This feed did not include an article body. Continue in the original source.
            </p>
          </>
        )}
      </div>
      <footer className={styles.articleFooter}>
        <AddToCollectionButton
          href={item.url}
          title={item.title}
          className={styles.collectionButton}
        />
        <Button asChild variant="outline" size="sm">
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            Open original
            <ExternalLink aria-hidden />
          </a>
        </Button>
      </footer>
    </article>
  );
}
