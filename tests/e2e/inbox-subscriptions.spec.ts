import { expect, test } from "playwright/test";

const FEED_URL = "https://feeds.example.test/rss.xml";
const RSS = `<rss version="2.0"><channel><title>Verto Notes</title>
  <link>https://example.test</link>
  <item><guid>story-1</guid><title>A useful story</title><link>https://example.test/stories/1</link><description><![CDATA[<p>The complete feed body.</p>]]></description></item>
</channel></rss>`;

test.describe("Inbox subscriptions", () => {
  test("adds a feed, syncs its articles, and exposes manual refresh", async ({ page }) => {
    await page.addInitScript(() => {
      if (window.localStorage.getItem("verto:collections")) return;
      window.localStorage.setItem(
        "verto:collections",
        JSON.stringify([
          {
            id: "reading-queue",
            name: "Reading queue",
            docHrefs: [],
            createdAt: "2026-07-01T00:00:00.000Z",
          },
        ])
      );
    });
    let requests = 0;
    await page.route(FEED_URL, async (route) => {
      requests += 1;
      await route.fulfill({ status: 200, contentType: "application/rss+xml", body: RSS });
    });
    await page.goto("/inbox");

    await expect(
      page.getByText("Bring your reading sources together", { exact: true })
    ).toBeVisible();
    const firstFeed = page.getByRole("link", { name: "Add your first feed" });
    await expect(firstFeed).toHaveAttribute("href", "#subscriptions");
    await firstFeed.click();
    await expect(page).toHaveURL(/#subscriptions$/);

    await page.getByRole("textbox", { name: "Feed URL" }).fill(FEED_URL);
    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.getByText("A useful story", { exact: true })).toBeVisible();
    await expect(page.getByText("Up to date", { exact: true })).toBeVisible();
    const refresh = page.getByRole("button", { name: "Refresh Verto Notes" });
    await expect(refresh).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove Verto Notes" })).toBeVisible();

    await page.getByRole("button", { name: "Preview A useful story" }).click();
    const preview = page.getByRole("dialog", { name: "A useful story" });
    await expect(preview).toBeVisible();
    await expect(preview.getByText("The complete feed body.", { exact: true })).toBeVisible();
    await expect(preview.getByRole("link", { name: "Open original article" })).toHaveAttribute(
      "href",
      "https://example.test/stories/1"
    );
    await preview.getByRole("button", { name: "Add to collection" }).click();
    await page.getByRole("menuitem", { name: "Add to Reading queue" }).click();
    await expect(preview.getByRole("button", { name: "In 1 collection" })).toBeVisible();
    await preview.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Sync feeds" }).click();
    await expect.poll(() => requests).toBe(2);
    await expect(page.getByText("A useful story", { exact: true })).toHaveCount(1);

    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByText("A useful story", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Archived" }).click();
    await expect(page.getByText("A useful story", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Delete A useful story from inbox" }).click();
    await expect(page.getByText("A useful story", { exact: true })).toHaveCount(0);

    await page.goto("/collections?collection=reading-queue");
    const savedArticle = page.getByRole("link", { name: /A useful story/ });
    await expect(savedArticle).toHaveAttribute("href", "https://example.test/stories/1");
    await expect(savedArticle).toHaveAttribute("target", "_blank");
    await expect(page.getByText("Web article", { exact: true })).toBeVisible();
    await expect(page.getByText("example.test · /stories/1", { exact: true })).toBeVisible();
  });
});

test.describe("Inbox stale subscriptions", () => {
  test("checks a saved, stale feed when Inbox opens", async ({ page }) => {
    await page.addInitScript(
      ({ feedUrl }) => {
        window.localStorage.setItem(
          "verto:subscriptions",
          JSON.stringify({
            subscriptions: [
              {
                feedUrl,
                title: "Saved Notes",
                createdAt: "2026-07-01T00:00:00.000Z",
                lastFetchedAt: "2026-07-01T00:00:00.000Z",
              },
            ],
          })
        );
      },
      { feedUrl: FEED_URL }
    );
    await page.route(FEED_URL, (route) =>
      route.fulfill({ status: 200, contentType: "application/rss+xml", body: RSS })
    );

    await page.goto("/inbox");

    await expect(page.getByText("A useful story", { exact: true })).toBeVisible();
    await expect(page.getByText("Checked 1 feed just now.", { exact: true })).toBeVisible();
  });
});

test.describe("Home Inbox entry", () => {
  test("takes a first-time reader directly to the feed setup", async ({ page }) => {
    await page.goto("/");

    const firstFeed = page.getByRole("link", { name: "Add your first feed" });
    await expect(firstFeed).toHaveAttribute("href", "/inbox#subscriptions");
    await firstFeed.click();

    await expect(page).toHaveURL(/\/inbox#subscriptions$/);
    await expect(page.getByRole("textbox", { name: "Feed URL" })).toBeVisible();
  });

  test("shows a caught-up state after a feed is connected without articles", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "verto:subscriptions",
        JSON.stringify({
          subscriptions: [
            {
              feedUrl: "https://feeds.example.test/rss.xml",
              title: "Verto Notes",
              createdAt: "2026-07-12T00:00:00.000Z",
              lastFetchedAt: new Date().toISOString(),
            },
          ],
        })
      );
    });

    await page.goto("/");

    await expect(page.getByText("1 active feed", { exact: true })).toBeVisible();
    await expect(
      page.getByText("All caught up. New articles will appear here automatically.", { exact: true })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Review inbox" })).toHaveAttribute(
      "href",
      "/inbox"
    );
  });
});

test.describe("Inbox subscriptions on mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps feed actions reachable without horizontal overflow", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "verto:subscriptions",
        JSON.stringify({
          subscriptions: [
            {
              feedUrl: "https://feeds.example.test/rss.xml",
              title: "Verto Notes",
              createdAt: "2026-07-12T00:00:00.000Z",
              lastFetchedAt: new Date().toISOString(),
            },
          ],
        })
      );
    });
    await page.goto("/inbox");

    await expect(page.getByRole("button", { name: "Sync feeds" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh Verto Notes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove Verto Notes" })).toBeVisible();
    await expect(page.getByText("Up to date", { exact: true })).toBeVisible();

    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  });

  test("keeps the first-feed call to action reachable without horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/inbox");

    const firstFeed = page.getByRole("link", { name: "Add your first feed" });
    await expect(firstFeed).toBeVisible();
    await firstFeed.click();
    await expect(page).toHaveURL(/#subscriptions$/);

    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  });

  test("keeps the home first-feed action reachable without horizontal overflow", async ({
    page,
  }) => {
    await page.goto("/");

    const firstFeed = page.getByRole("link", { name: "Add your first feed" });
    await expect(firstFeed).toHaveAttribute("href", "/inbox#subscriptions");
    await firstFeed.click();
    await expect(page).toHaveURL(/\/inbox#subscriptions$/);

    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  });

  test("keeps the article preview within the viewport", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "verto:collections",
        JSON.stringify([
          {
            id: "mobile-reading",
            name: "Mobile reading",
            docHrefs: [],
            createdAt: "2026-07-01T00:00:00.000Z",
          },
        ])
      );
      window.localStorage.setItem(
        "verto:inbox",
        JSON.stringify({
          items: [
            {
              id: "mobile-story",
              feedUrl: "https://feeds.example.test/rss.xml",
              sourceName: "Verto Notes",
              title: "A mobile story",
              url: "https://example.test/mobile-story",
              content: "A readable article preview on a compact screen.",
              status: "unread",
              createdAt: "2026-07-12T00:00:00.000Z",
            },
          ],
        })
      );
    });
    await page.goto("/inbox");

    await page.getByRole("button", { name: "Preview A mobile story" }).click();
    const preview = page.getByRole("dialog", { name: "A mobile story" });
    await expect(preview).toBeVisible();
    await expect(
      preview.getByText("A readable article preview on a compact screen.", { exact: true })
    ).toBeVisible();
    await preview.getByRole("button", { name: "Add to collection" }).click();
    await page.getByRole("menuitem", { name: "Add to Mobile reading" }).click();
    await expect(preview.getByRole("button", { name: "In 1 collection" })).toBeVisible();
    await page.waitForTimeout(350);

    const bounds = await preview.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        viewportWidth: document.documentElement.clientWidth,
      };
    });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
    expect(bounds.width).toBeCloseTo(bounds.viewportWidth, 0);

    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  });
});
