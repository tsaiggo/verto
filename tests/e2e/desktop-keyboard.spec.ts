import { expect, test } from "playwright/test";

test.describe("Desktop product shortcuts", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("opens search and product actions without leaving the keyboard", async ({ page }) => {
    test.setTimeout(90_000);

    // The CI dev server compiles destinations lazily. Warm them first so this
    // assertion measures keyboard routing, not an unrelated cold compiler.
    for (const destination of ["/search", "/editor"]) {
      const response = await page.request.get(destination, { timeout: 45_000 });
      expect(response.ok()).toBe(true);
    }

    await page.goto("/library");
    await expect(page.locator("[data-page-identity]")).toBeVisible();
    await expect(page.locator(".vx-topbar")).toHaveAttribute("data-shortcuts-ready", "true");
    await page.keyboard.press("Control+k");
    await expect(page).toHaveURL(/\/search$/, { timeout: 10_000 });

    await page.goto("/library");
    await expect(page.locator(".vx-topbar")).toHaveAttribute("data-shortcuts-ready", "true");
    const actions = page.getByRole("button", { name: "Product actions" }).last();
    await actions.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(actions).toBeFocused();

    await page.keyboard.press("Meta+n");
    await expect(page).toHaveURL(/\/editor$/, { timeout: 10_000 });
  });
});
