import { expect, test } from "playwright/test";

test.describe("Desktop icon rail visual contract", () => {
  test.use({ colorScheme: "light", viewport: { width: 1280, height: 800 } });

  test("keeps the rail light, compact, and fully usable", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const canvas = document.querySelector<HTMLElement>("[data-shell-root]")!;
      const rail = document.querySelector<HTMLElement>(
        '[data-shell-rail] nav[aria-label="App navigation"]'
      )!;
      const activeItem = rail.querySelector<HTMLElement>('[aria-current="page"]')!;
      const searchCommand = rail.querySelector<HTMLElement>('[aria-label="Search"]')!;
      const inbox = rail.querySelector<HTMLElement>('[aria-label="Inbox"]')!;
      const activeRect = activeItem.getBoundingClientRect();
      const searchRect = searchCommand.getBoundingClientRect();
      const inboxRect = inbox.getBoundingClientRect();

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
        inboxWidth: inboxRect.width,
        inboxHeight: inboxRect.height,
        rootClientWidth: root.clientWidth,
        rootScrollWidth: root.scrollWidth,
      };
    });

    expect(metrics.railWidth).toBeCloseTo(56, 0);
    expect(metrics.canvasBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(metrics.railBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(metrics.activeBackground).not.toBe(metrics.railBackground);
    expect(metrics.activeWidth).toBeCloseTo(35, 0);
    expect(metrics.activeHeight).toBeCloseTo(35, 0);
    expect(metrics.searchWidth).toBeCloseTo(35, 0);
    expect(metrics.searchHeight).toBeCloseTo(35, 0);
    expect(metrics.inboxWidth).toBeCloseTo(35, 0);
    expect(metrics.inboxHeight).toBeCloseTo(35, 0);
    expect(metrics.railScrollWidth).toBeLessThanOrEqual(metrics.railClientWidth + 1);
    expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
  });
});
