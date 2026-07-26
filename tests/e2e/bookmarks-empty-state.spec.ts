import { expect, test } from "playwright/test";

test.describe("Empty bookmarks", () => {
  test("guides readers back to the library", async ({ page }) => {
    await page.goto("/bookmarks");

    await expect(page.getByRole("heading", { name: "Start a shortlist" })).toBeVisible();
    const browse = page.getByRole("link", { name: "Browse Library" });
    await expect(browse).toHaveAttribute("href", "/library");

    await browse.click();
    await expect(page).toHaveURL(/\/library$/);
  });

  test("supports arrow-key navigation across bookmark categories", async ({ page }) => {
    await page.goto("/bookmarks");

    const all = page.getByRole("tab", { name: "All" });
    await all.focus();
    await page.keyboard.press("ArrowRight");
    const documents = page.getByRole("tab", { name: "Documents" });
    await expect(documents).toBeFocused();
    await expect(documents).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      "bookmark-tab-document"
    );

    await page.keyboard.press("End");
    await expect(page.getByRole("tab", { name: "Notes" })).toBeFocused();
  });
});

test.describe("Bookmarks on mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps a populated bookmark row and its remove action inside the viewport", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "verto:bookmarks",
        JSON.stringify([
          {
            href: "/read/demo",
            title: "A deliberately long saved document title for the mobile layout",
            kind: "document",
            addedAt: "2026-07-26T09:00:00.000Z",
          },
        ])
      );
    });
    await page.goto("/bookmarks");

    await expect(
      page.getByRole("link", {
        name: "A deliberately long saved document title for the mobile layout",
      })
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Remove bookmark: A deliberately long saved document title for the mobile layout",
      })
    ).toBeVisible();

    const width = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
  });
});
