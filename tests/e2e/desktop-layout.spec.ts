import { expect, test } from "playwright/test";

const desktopWidths = [1024, 1280, 1440];
const routes = ["/", "/library", "/integrations", "/agent", "/read/demo"];

for (const width of desktopWidths) {
  test.describe(`${width}px desktop`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const route of routes) {
      test(`${route} keeps the application frame free of horizontal overflow`, async ({ page }) => {
        await page.goto(route);
        await expect(page.locator("#main-content")).toBeVisible();

        const metrics = await page.evaluate(() => {
          const root = document.documentElement;
          const content = document.querySelector<HTMLElement>(".vx-content, .app-content");
          return {
            rootClientWidth: root.clientWidth,
            rootScrollWidth: root.scrollWidth,
            contentClientWidth: content?.clientWidth ?? 0,
          };
        });

        expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
        expect(metrics.contentClientWidth).toBeGreaterThan(0);
      });
    }
  });
}
