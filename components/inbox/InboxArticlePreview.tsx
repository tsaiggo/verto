"use client";

import { ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AddToCollectionButton } from "@/components/reader/AddToCollectionButton";
import { formatDate } from "@/lib/format";
import type { InboxItem } from "@/lib/inbox";
import styles from "@/components/inbox/InboxView.module.css";

interface InboxArticlePreviewProps {
  item: InboxItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function metadata(item: InboxItem): string {
  return [item.sourceName, item.author, item.publishedAt ? formatDate(item.publishedAt) : null]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
}

/** A safe, local reading surface for plain-text content supplied by a feed. */
export default function InboxArticlePreview({
  item,
  open,
  onOpenChange,
}: InboxArticlePreviewProps) {
  if (!item) return null;

  const paragraphs = item.content?.split(/\n{2,}/).filter(Boolean) ?? [];
  const hasBody = paragraphs.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={styles.previewSheet}
        data-testid="inbox-article-preview"
      >
        <SheetHeader className={styles.previewHeader}>
          <span className={styles.previewKicker}>
            <FileText aria-hidden />
            {item.sourceName || "Subscription"}
          </span>
          <SheetTitle className={styles.previewTitle}>{item.title}</SheetTitle>
          <SheetDescription className={styles.previewMeta}>{metadata(item)}</SheetDescription>
        </SheetHeader>

        <div className={styles.previewBody}>
          {hasBody ? (
            <div className={styles.previewContent}>
              {paragraphs.map((paragraph, index) => (
                <p key={`${item.id}-${index}`}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <div className={styles.previewEmpty}>
              {item.summary && <p>{item.summary}</p>}
              <p>
                This feed did not include a readable article body. Continue in the original source.
              </p>
            </div>
          )}
        </div>

        <footer className={styles.previewFooter}>
          <AddToCollectionButton
            href={item.url}
            title={item.title}
            className={styles.previewCollection}
          />
          <Button asChild>
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              Open original article
              <ExternalLink aria-hidden />
            </a>
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}
