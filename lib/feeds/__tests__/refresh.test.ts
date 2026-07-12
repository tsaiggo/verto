import { describe, expect, it, vi } from "vitest";

import { refreshSubscription } from "@/lib/feeds/refresh";
import type { Subscription } from "@/lib/subscriptions";
import type { FetchLike } from "@/lib/tauri";

const FEED_URL = "https://feeds.example.test/rss.xml";
const NOW = "2026-07-12T00:00:00.000Z";
const RSS = `<rss version="2.0"><channel><title>Verto Notes</title>
  <link>https://example.test</link>
  <item><guid>story-1</guid><title>A useful story</title><link>https://example.test/stories/1</link></item>
</channel></rss>`;

const subscription: Subscription = {
  feedUrl: FEED_URL,
  title: "feeds.example.test",
  createdAt: "2026-07-01T00:00:00.000Z",
};

describe("refreshSubscription", () => {
  it("updates feed metadata and produces Inbox items from a fetched feed", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => new Response(RSS, { status: 200 }));

    const result = await refreshSubscription(subscription, fetchImpl, { now: NOW });

    expect(result.subscription).toEqual({
      ...subscription,
      title: "Verto Notes",
      siteUrl: "https://example.test",
      lastFetchedAt: NOW,
    });
    expect(result.itemCount).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: "story-1",
        feedUrl: FEED_URL,
        sourceName: "Verto Notes",
        title: "A useful story",
        url: "https://example.test/stories/1",
        createdAt: NOW,
      }),
    ]);
  });

  it("keeps locally known metadata when a feed leaves it blank", async () => {
    const fetchImpl: FetchLike = vi.fn(
      async () =>
        new Response('<rss version="2.0"><channel><title> </title></channel></rss>', {
          status: 200,
        })
    );
    const known = { ...subscription, siteUrl: "https://known.example.test" };

    const result = await refreshSubscription(known, fetchImpl, { now: NOW });

    expect(result.subscription).toEqual({ ...known, lastFetchedAt: NOW });
    expect(result.items).toEqual([]);
  });
});
