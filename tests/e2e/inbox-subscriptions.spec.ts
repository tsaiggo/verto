import { expect, test } from "playwright/test";

const FEED_URL = "https://feeds.example.test/rss.xml";
const RSS = `<rss version="2.0"><channel><title>Verto Notes</title>
  <link>https://example.test</link>
  <item><guid>story-1</guid><title>A useful story</title><link>https://example.test/stories/1</link></item>
</channel></rss>`;

test.describe("Inbox subscriptions", () => {
  test("adds a feed, syncs its articles, and exposes manual refresh", async ({ page }) => {
    let requests = 0;
    await page.route(FEED_URL, async (route) => {
      requests += 1;
      await route.fulfill({ status: 200, contentType: "application/rss+xml", body: RSS });
    });
    await page.goto("/inbox");

    await page.getByRole("textbox", { name: "Feed URL" }).fill(FEED_URL);
    await page.getByRole("button", { name: "Add" }).click();

    await expect(page.getByText("A useful story", { exact: true })).toBeVisible();
    const refresh = page.getByRole("button", { name: "Refresh Verto Notes" });
    await expect(refresh).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove Verto Notes" })).toBeVisible();

    await refresh.click();
    await expect.poll(() => requests).toBe(2);
    await expect(page.getByText("A useful story", { exact: true })).toHaveCount(1);
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
            },
          ],
        })
      );
    });
    await page.goto("/inbox");

    await expect(page.getByRole("button", { name: "Refresh Verto Notes" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove Verto Notes" })).toBeVisible();

    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  });
});
