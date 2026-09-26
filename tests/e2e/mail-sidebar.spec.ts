import { expect, test } from "playwright/test";

test.describe("Desktop Mail navigation", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("uses product names and opens the Mail workspace", async ({ page }) => {
    await page.goto("/mail");

    const rail = page.locator('[data-testid="workspace-shell"]');
    await expect(rail.getByRole("link", { name: "Mail", exact: true })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(rail.getByRole("link", { name: "Recent" })).toHaveAttribute("href", "/recent");
    await expect(rail.getByRole("link", { name: "Library" })).toHaveAttribute("href", "/library");
    await expect(rail.getByRole("link", { name: "Sources" })).toHaveAttribute(
      "href",
      "/integrations"
    );
    await expect(rail.getByRole("link", { name: "Settings" })).toHaveCount(1);
    await expect(rail.getByRole("button", { name: "Messages" })).toHaveCount(0);

    await expect(page.getByRole("heading", { name: "Mail", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Connect your mail" })).toBeVisible();
    await expect(page.locator('[data-testid="workspace-mail-panel"]')).toBeVisible();
  });
});
