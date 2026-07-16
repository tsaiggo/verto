import { expect, test } from "playwright/test";

test.describe("ReaderFrame route contract", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("keeps documents on one shared tabs, scroll, and outline frame", async ({ page }) => {
    await page.goto("/read/demo");
    await expect(page.locator("[data-article]")).toBeVisible();

    const scroll = page.locator("[data-page-scroll]");
    await expect(scroll).toHaveCount(1);
    await expect(scroll).toHaveAttribute("data-reader-tabs", "present");
    await expect(page.locator(".app-tabs")).toBeVisible();
    await expect(page.locator(".reader-workbench")).not.toHaveClass(/is-single-column/);
    await expect(page.locator("[data-context-panel]")).toBeVisible();

    const order = await page.evaluate(() => {
      const tabs = document.querySelector(".app-tabs");
      const scrollOwner = document.querySelector("[data-page-scroll]");
      if (!tabs || !scrollOwner) throw new Error("Document frame is incomplete");
      return tabs.compareDocumentPosition(scrollOwner) & Node.DOCUMENT_POSITION_FOLLOWING;
    });
    expect(order).toBeTruthy();
  });

  for (const state of [
    { route: "/read", label: "Directory content" },
    { route: "/read/tags/demo", label: "Tagged documents" },
    { route: "/runtime/local", label: "Runtime document content" },
  ]) {
    test(`${state.route} stays on the shared single-column frame`, async ({ page }) => {
      await page.goto(state.route);
      await expect(page.getByRole("region", { name: state.label })).toBeVisible();

      const scroll = page.locator("[data-page-scroll]");
      await expect(scroll).toHaveCount(1);
      await expect(scroll).toHaveAttribute("data-reader-tabs", "absent");
      await expect(page.locator(".reader-workbench")).toHaveClass(/is-single-column/);
      await expect(page.locator(".app-tabs")).toHaveCount(0);
      await expect(page.locator("[data-context-panel]")).toHaveCount(0);

      const widths = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
    });
  }
});
