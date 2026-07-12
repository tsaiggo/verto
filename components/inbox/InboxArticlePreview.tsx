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
import { formatDate } from "@/lib/format";
import type { InboxItem } from "@/lib/inbox";

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
        className="inbox-preview-sheet"
        data-testid="inbox-article-preview"
      >
        <SheetHeader className="inbox-preview-header">
          <span className="inbox-preview-kicker">
            <FileText aria-hidden />
            {item.sourceName || "Subscription"}
          </span>
          <SheetTitle className="inbox-preview-title">{item.title}</SheetTitle>
          <SheetDescription className="inbox-preview-meta">{metadata(item)}</SheetDescription>
        </SheetHeader>

        <div className="inbox-preview-body">
          {hasBody ? (
            <div className="inbox-preview-content">
              {paragraphs.map((paragraph, index) => (
                <p key={`${item.id}-${index}`}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <div className="inbox-preview-empty">
              {item.summary && <p>{item.summary}</p>}
              <p>
                This feed did not include a readable article body. Continue in the original source.
              </p>
            </div>
          )}
        </div>

        <footer className="inbox-preview-footer">
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
