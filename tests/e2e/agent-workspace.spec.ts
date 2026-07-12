import { expect, test } from "playwright/test";

test.describe("Agent workspace", () => {
  test("shows a clear next step when the assistant has not been configured", async ({ page }) => {
    await page.goto("/agent");

    const composer = page.getByRole("textbox", { name: "Message the agent" });
    await expect(composer).toBeDisabled();
    await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
    await expect(
      page.getByText("This build has no AI provider enabled", { exact: false })
    ).toBeVisible();
    const settings = page.getByRole("link", { name: "Open AI & Agent settings" });
    await expect(settings).toBeVisible();
    await settings.click();
    await expect(page).toHaveURL(/\/settings\/agent$/);
    await expect(page.getByText("The assistant is off.", { exact: false })).toBeVisible();

    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Library" })
      .click();
    await expect(page).toHaveURL(/\/library$/);
    await page
      .getByRole("navigation", { name: "Tools" })
      .getByRole("link", { name: "Agent" })
      .click();
    await expect(page).toHaveURL(/\/agent$/);
    await expect(composer).toBeDisabled();
  });
});

test.describe("Agent workspace on mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps conversation controls and setup guidance available", async ({ page }) => {
    await page.goto("/agent");

    const history = page.locator(".ag-history");
    await expect(history).toBeVisible();
    await expect(history).toHaveCSS("display", "flex");
    await expect(history.getByRole("button", { name: "New Chat" }).first()).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Message the agent" })).toBeDisabled();
    await expect(page.getByRole("link", { name: "Open AI & Agent settings" })).toBeVisible();

    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      return { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });
});
