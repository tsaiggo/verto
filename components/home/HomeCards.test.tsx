import { describe, expect, it } from "vitest";
import { deriveInboxTriageSummary } from "@/components/home/HomeCards";
import type { InboxItem } from "@/lib/inbox";

function inboxItem(status: InboxItem["status"]): InboxItem {
  return {
    id: `item-${status}`,
    feedUrl: "https://example.com/feed.xml",
    sourceName: "Example",
    title: "Example article",
    url: "https://example.com/article",
    status,
    createdAt: "2026-07-12T00:00:00.000Z",
  };
}

describe("deriveInboxTriageSummary", () => {
  it("sends a first-time reader directly to the feed form", () => {
    expect(deriveInboxTriageSummary([], 0)).toMatchObject({
      kind: "setup",
      actionHref: "/inbox#subscriptions",
      actionLabel: "Add your first feed",
    });
  });

  it("recognizes that an empty subscribed inbox is caught up, not unconfigured", () => {
    expect(deriveInboxTriageSummary([], 2)).toMatchObject({
      kind: "caught-up",
      subscriptionCount: 2,
      actionHref: "/inbox",
      actionLabel: "Review inbox",
    });
  });

  it("prioritizes unread and in-progress articles over setup state", () => {
    expect(deriveInboxTriageSummary([inboxItem("unread"), inboxItem("reading")], 1)).toMatchObject({
      kind: "attention",
      unread: 1,
      reading: 1,
      actionHref: "/inbox",
      actionLabel: "Review inbox",
    });
  });
});
