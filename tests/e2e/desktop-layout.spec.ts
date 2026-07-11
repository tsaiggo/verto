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
test.describe("Windows desktop shell", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const route of routes) {
    test(`${route} keeps scrolling inside the app shell when the title bar is active`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page.locator("#main-content")).toBeVisible();

      const metrics = await page.evaluate(() => {
        document.documentElement.classList.add("has-titlebar");

        const root = document.documentElement;
        const body = document.body;
        const shell = document.querySelector<HTMLElement>(".vx-shell, .app-shell");

        return {
          rootClientHeight: root.clientHeight,
          rootScrollHeight: root.scrollHeight,
          bodyClientHeight: body.clientHeight,
          bodyScrollHeight: body.scrollHeight,
          bodyOverflow: getComputedStyle(body).overflowY,
          shellHeight: shell?.getBoundingClientRect().height ?? 0,
        };
      });

      expect(metrics.rootScrollHeight).toBeLessThanOrEqual(metrics.rootClientHeight + 1);
      expect(metrics.bodyScrollHeight).toBeLessThanOrEqual(metrics.bodyClientHeight + 1);
      expect(metrics.bodyOverflow).toBe("hidden");
      expect(metrics.shellHeight).toBeCloseTo(760, 0);
    });
  }
});

test.describe("390px mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps dashboard summary cards content-dense", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();

    const heights = await page
      .locator(".home-row-3 .home-card")
      .evaluateAll((cards) => cards.map((card) => Math.round(card.getBoundingClientRect().height)));

    expect(heights).toHaveLength(3);
    expect(Math.max(...heights)).toBeLessThan(280);
  });

  test("keeps the reader usable and exposes the primary navigation as a modal", async ({
    page,
  }) => {
    await page.goto("/read/demo");
    await expect(page.locator("#main-content")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const content = document.querySelector<HTMLElement>(".app-content");
      return {
        rootClientWidth: root.clientWidth,
        rootScrollWidth: root.scrollWidth,
        contentClientWidth: content?.clientWidth ?? 0,
      };
    });

    expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
    expect(metrics.contentClientWidth).toBeGreaterThanOrEqual(360);

    await page.getByRole("button", { name: "Open navigation" }).click();
    const navigation = page.getByRole("dialog", { name: "Primary navigation" });
    await expect(navigation).toBeVisible();

    await navigation.getByRole("link", { name: "Library" }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(navigation).not.toBeVisible();
  });
});
