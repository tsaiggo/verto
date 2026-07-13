import { expect, test } from "playwright/test";

test.describe("Reader settings", () => {
  test("uses the reader's dark palette for preferences", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
    await page.goto("/read/demo");

    const settings = page.getByRole("button", { name: "Reading settings" });
    await expect(settings).toBeEnabled();
    await settings.click();

    const popover = page.getByTestId("reading-settings-popover");
    await expect(popover).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(popover).toHaveCSS("background-color", "rgb(22, 24, 27)");
    await expect(popover).toHaveCSS("color", "rgb(236, 236, 236)");
  });
});
