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

  test("keeps task lists interactive and local to the current reader", async ({ page }) => {
    await page.goto("/read/demo");

    const task = page.getByRole("checkbox", { name: "Task: Expand a Toggle above" });
    await expect(task).toBeEnabled();
    await expect(task).not.toBeChecked();

    await task.check();
    await expect(task).toBeChecked();

    await page.reload();
    await expect(task).toBeChecked();
  });
});
