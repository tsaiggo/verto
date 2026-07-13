import { describe, expect, it } from "vitest";

import { formatRssSync } from "@/components/integrations/RssSourceDetail";

describe("formatRssSync", () => {
  it("does not present a subscription timestamp as a successful sync", () => {
    expect(
      formatRssSync([
        {
          feedUrl: "https://feeds.example.test/rss.xml",
          title: "Example feed",
          createdAt: "2026-07-12T00:00:00.000Z",
          lastSyncErrorAt: "2026-07-12T00:01:00.000Z",
        },
      ])
    ).toBe("-");
  });

  it("shows a sync date only after a feed successfully refreshes", () => {
    expect(
      formatRssSync([
        {
          feedUrl: "https://feeds.example.test/rss.xml",
          title: "Example feed",
          createdAt: "2026-07-12T00:00:00.000Z",
          lastFetchedAt: "2026-07-12T00:02:00.000Z",
        },
      ])
    ).not.toBe("-");
  });
});
