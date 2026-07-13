import { expect, test } from "playwright/test";

test.describe("Desktop sidebar visual contract", () => {
  test.use({ colorScheme: "light", viewport: { width: 1280, height: 800 } });

  test("keeps the restrained reference proportions and palette", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const canvas = document.querySelector<HTMLElement>("[data-shell-root]")!;
      const rail = document.querySelector<HTMLElement>("[data-shell-rail]")!;
      const activeItem = document.querySelector<HTMLElement>(".vx-nav-item.is-active")!;
      const searchCommand = document.querySelector<HTMLElement>(
        '.vx-command-link[aria-label="Search"]'
      )!;
      const keycap = searchCommand.querySelector<HTMLElement>(".vx-command-kbd")!;
      const keycapRect = keycap.getBoundingClientRect();

      return {
        railWidth: rail.getBoundingClientRect().width,
        canvasBackground: getComputedStyle(canvas).backgroundColor,
        railBackground: getComputedStyle(rail).backgroundColor,
        railClientWidth: rail.clientWidth,
        railScrollWidth: rail.scrollWidth,
        activeBackground: getComputedStyle(activeItem).backgroundColor,
        commandFontSize: getComputedStyle(searchCommand).fontSize,
        keycapWidth: keycapRect.width,
        keycapHeight: keycapRect.height,
        rootClientWidth: root.clientWidth,
        rootScrollWidth: root.scrollWidth,
      };
    });

    expect(metrics.railWidth).toBeCloseTo(260, 0);
    expect(metrics.canvasBackground).toBe("rgb(243, 243, 243)");
    expect(metrics.railBackground).toBe("rgb(243, 243, 243)");
    expect(metrics.activeBackground).toBe("rgb(233, 233, 235)");
    expect(metrics.commandFontSize).toBe("16px");
    expect(metrics.keycapWidth).toBeCloseTo(34, 0);
    expect(metrics.keycapHeight).toBeCloseTo(24, 0);
    expect(metrics.railScrollWidth).toBeLessThanOrEqual(metrics.railClientWidth + 1);
    expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
  });
});
