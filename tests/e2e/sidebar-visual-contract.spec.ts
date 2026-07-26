import { expect, test } from "playwright/test";

test.describe("Desktop icon rail visual contract", () => {
  test.use({ colorScheme: "light", viewport: { width: 1280, height: 800 } });

  test("keeps the rail light, compact, and fully usable", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const canvas = document.querySelector<HTMLElement>("[data-shell-root]")!;
      const rail = document.querySelector<HTMLElement>("[data-shell-rail]")!;
      const activeItem = rail.querySelector<HTMLElement>('[aria-current="page"]')!;
      const searchCommand = rail.querySelector<HTMLElement>('[aria-label="Search"]')!;
      const newDocument = rail.querySelector<HTMLElement>('[aria-label="New document"]')!;
      const activeRect = activeItem.getBoundingClientRect();
      const searchRect = searchCommand.getBoundingClientRect();
      const newDocumentRect = newDocument.getBoundingClientRect();

      return {
        railWidth: rail.getBoundingClientRect().width,
        canvasBackground: getComputedStyle(canvas).backgroundColor,
        railBackground: getComputedStyle(rail).backgroundColor,
        railClientWidth: rail.clientWidth,
        railScrollWidth: rail.scrollWidth,
        activeBackground: getComputedStyle(activeItem).backgroundColor,
        activeWidth: activeRect.width,
        activeHeight: activeRect.height,
        searchWidth: searchRect.width,
        searchHeight: searchRect.height,
        newDocumentWidth: newDocumentRect.width,
        newDocumentHeight: newDocumentRect.height,
        rootClientWidth: root.clientWidth,
        rootScrollWidth: root.scrollWidth,
      };
    });

    expect(metrics.railWidth).toBeCloseTo(64, 0);
    expect(metrics.canvasBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(metrics.railBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(metrics.activeBackground).not.toBe(metrics.railBackground);
    expect(metrics.activeWidth).toBeGreaterThanOrEqual(38);
    expect(metrics.activeWidth).toBeLessThanOrEqual(42);
    expect(metrics.activeHeight).toBeGreaterThanOrEqual(38);
    expect(metrics.activeHeight).toBeLessThanOrEqual(42);
    expect(metrics.searchWidth).toBeGreaterThanOrEqual(38);
    expect(metrics.searchWidth).toBeLessThanOrEqual(42);
    expect(metrics.searchHeight).toBeGreaterThanOrEqual(38);
    expect(metrics.searchHeight).toBeLessThanOrEqual(42);
    expect(metrics.newDocumentWidth).toBeGreaterThanOrEqual(38);
    expect(metrics.newDocumentWidth).toBeLessThanOrEqual(42);
    expect(metrics.newDocumentHeight).toBeGreaterThanOrEqual(38);
    expect(metrics.newDocumentHeight).toBeLessThanOrEqual(42);
    expect(metrics.railScrollWidth).toBeLessThanOrEqual(metrics.railClientWidth + 1);
    expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
  });
});
