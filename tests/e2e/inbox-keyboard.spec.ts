import { expect, test } from "playwright/test";

test("supports keyboard navigation across Inbox filters", async ({ page }) => {
  await page.goto("/inbox");

  const all = page.getByRole("tab", { name: /^All/ });
  const unread = page.getByRole("tab", { name: /^Unread/ });
  const archived = page.getByRole("tab", { name: /^Archived/ });

  await all.focus();
  await page.keyboard.press("ArrowRight");
  await expect(unread).toBeFocused();
  await expect(unread).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("End");
  await expect(archived).toBeFocused();
  await expect(archived).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "inbox-tab-archived");
});

test("opens feed management and returns focus from an inline article preview", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "verto:inbox",
      JSON.stringify({
        items: [
          {
            id: "keyboard-story",
            feedUrl: "https://feeds.example.test/rss.xml",
            sourceName: "Notes",
            title: "Keyboard story",
            url: "https://example.test/keyboard-story",
            content: "A readable feed body.",
            status: "unread",
            createdAt: "2026-07-12T00:00:00.000Z",
          },
        ],
      })
    );
  });
  await page.goto("/inbox");
  await expect(page.locator("#subscriptions")).toBeHidden();
  await page.getByRole("button", { name: "Add feed", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Feed URL" })).toBeFocused();
  const manage = page.getByRole("button", { name: /Manage feeds/ });
  await expect(manage).toHaveAttribute("aria-expanded", "true");
  await manage.click();
  const story = page.getByRole("button", { name: "Preview Keyboard story" });
  await story.focus();
  await page.keyboard.press("Enter");
  const preview = page.getByTestId("inbox-article-preview");
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("heading", { name: "Keyboard story" })).toBeFocused();
  const collections = preview.getByRole("button", { name: "Add to collection", exact: true });
  await collections.click();
  const menu = page.getByRole("menu", { name: "Add to collection", exact: true });
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(preview).toBeVisible();
  await expect(collections).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await expect(story).toBeFocused();
});
