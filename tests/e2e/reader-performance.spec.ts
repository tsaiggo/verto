import { expect, test } from "playwright/test";

test.describe("Reader performance", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("keeps distant diagrams idle during initial document rendering", async ({ page }) => {
    await page.goto("/read/demo");

    const mermaid = page.locator(".mermaid").first();
    await expect(mermaid).toBeAttached();
    await page.waitForTimeout(1800);

    await expect(mermaid.locator("svg")).toHaveCount(0);
    await expect(page.locator(".excalidraw-host svg")).toHaveCount(0);
  });
  test("loads a diagram as the reader approaches it", async ({ page }) => {
    await page.goto("/read/demo");

    const mermaid = page.locator(".mermaid").first();
    await mermaid.scrollIntoViewIfNeeded();

    await expect(mermaid.locator("svg")).toBeVisible({ timeout: 15_000 });
  });
});
