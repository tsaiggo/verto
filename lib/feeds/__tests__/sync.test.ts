import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { syncSubscriptions } from "@/lib/feeds/sync";
import { loadInbox } from "@/lib/inbox";
import { loadSubscriptions, saveSubscriptions, type Subscription } from "@/lib/subscriptions";
import type { FetchLike } from "@/lib/tauri";

const first: Subscription = {
  feedUrl: "https://feeds.example.test/first.xml",
  title: "First",
  createdAt: "2026-07-01T00:00:00.000Z",
};
const second: Subscription = {
  feedUrl: "https://feeds.example.test/second.xml",
  title: "Second",
  createdAt: "2026-07-01T00:00:00.000Z",
};

function rss(title: string, id: string): string {
  return `<rss version="2.0"><channel><title>${title}</title>
    <link>https://example.test</link><item><guid>${id}</guid><title>${title} story</title>
    <link>https://example.test/${id}</link></item></channel></rss>`;
}

describe("syncSubscriptions", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
      addEventListener: () => {},
      dispatchEvent: () => true,
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("persists successful feeds while keeping a failed feed isolated", async () => {
    const fetchImpl: FetchLike = vi.fn(async (url: string) => {
      if (url === second.feedUrl) throw new TypeError("offline");
      return new Response(rss("First Notes", "first-story"), { status: 200 });
    });

    saveSubscriptions({ subscriptions: [first, second] });
    const results = await syncSubscriptions([first, second], fetchImpl, { concurrency: 1 });

    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
    expect(results[0]).toMatchObject({ status: "fulfilled", value: { addedCount: 1 } });
    expect(loadSubscriptions().subscriptions[0]).toMatchObject({
      feedUrl: first.feedUrl,
      title: "First Notes",
      lastFetchedAt: expect.any(String),
    });
    expect(loadInbox().items).toEqual([
      expect.objectContaining({ id: "first-story", sourceName: "First Notes" }),
    ]);
    expect(
      loadSubscriptions().subscriptions.find((subscription) => subscription.feedUrl === second.feedUrl)
    ).toMatchObject({ lastSyncErrorAt: expect.any(String) });
  });
});
