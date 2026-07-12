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
});
