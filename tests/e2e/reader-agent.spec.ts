import { expect, test } from "playwright/test";

test.describe("Reader Agent pane", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("stays visible when AI is not configured and can be collapsed", async ({ page }) => {
    await page.goto("/read/demo");
    const panel = page.getByRole("complementary", { name: "Agent" });
    await expect(page.locator('[data-reader-state="ready"] .chat-col')).toHaveAttribute(
      "data-ready",
      "true"
    );
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Read with Agent")).toBeVisible();
    await expect(panel.getByText("page-level evidence", { exact: false })).toBeVisible();
    await expect(panel.getByText("Current page · Verto Feature Demo")).toBeVisible();
    await expect(panel.getByRole("link", { name: "Choose AI provider" })).toHaveAttribute(
      "href",
      "/settings/agent"
    );

    await panel.getByRole("button", { name: "Collapse chat" }).click();
    const launcher = page.getByRole("button", { name: "Open Agent" });
    await expect(launcher).toBeVisible();
    await launcher.click();
    await expect(panel).toBeVisible();
  });
});

test.describe("Reader Agent sheet", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens as a modal, closes with Escape, and restores focus", async ({ page }) => {
    await page.goto("/read/demo");
    await expect(page.locator('[data-reader-state="ready"] .chat-col')).toHaveAttribute(
      "data-ready",
      "true"
    );

    const launcher = page.getByRole("button", { name: "Open Agent" });
    await expect(launcher).toBeVisible();
    await launcher.focus();
    await launcher.click();

    const dialog = page.getByRole("dialog", { name: "Agent" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(launcher).toBeFocused();

    const overflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  });
});
