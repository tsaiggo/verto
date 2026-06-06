// Map a parsed feed into Inbox items ready for `lib/inbox.ts`.
//
// This bridges the feed domain (`ParsedFeed`) to the storage domain
// (`InboxItem`). It enforces what the Inbox store requires — an absolute
// http(s) link and a non-empty title — so the caller can persist the result
// with `saveInboxItem` / `upsertInboxItem` without further validation. Relative
// entry links are resolved against the feed's site URL.

import type { InboxItem } from "@/lib/inbox";
import type { ParsedFeed } from "./parse";

export interface ToInboxOptions {
  /** ISO timestamp used for every item's `createdAt` (injected for tests). */
  now?: string;
}

function asHttpUrl(input: string, base?: string): string | null {
  try {
    const url = base ? new URL(input, base) : new URL(input);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    return isHttp ? url.toString() : null;
  } catch {
    return null;
  }
}

function absoluteHttpUrl(link: string, base?: string): string | null {
  return asHttpUrl(link) ?? (base ? asHttpUrl(link, base) : null);
}

function hostLabel(feedUrl: string): string {
  try {
    return new URL(feedUrl).host;
  } catch {
    return feedUrl;
  }
}

/**
 * Convert a `ParsedFeed` into `InboxItem`s for the subscription at `feedUrl`.
 * Entries without a resolvable http(s) link or a title are skipped, duplicate
 * ids are collapsed, and feed order is preserved. Every item starts `unread`.
 */
export function parsedFeedToInboxItems(
  feed: ParsedFeed,
  feedUrl: string,
  options: ToInboxOptions = {},
): InboxItem[] {
  const createdAt = options.now ?? new Date().toISOString();
  const sourceName = feed.title.trim() || hostLabel(feedUrl);
  const seen = new Set<string>();
  const items: InboxItem[] = [];

  for (const entry of feed.entries) {
    const url = absoluteHttpUrl(entry.link, feed.siteUrl);
    if (!url) continue;
    const title = entry.title.trim();
    if (!title) continue;

    const id = entry.id.trim() || url;
    if (seen.has(id)) continue;
    seen.add(id);

    const item: InboxItem = {
      id,
      feedUrl,
      sourceName,
      title,
      url,
      status: "unread",
      createdAt,
    };
    if (entry.author) item.author = entry.author;
    if (entry.publishedAt) item.publishedAt = entry.publishedAt;
    if (entry.summary) item.summary = entry.summary;
    items.push(item);
  }

  return items;
}
