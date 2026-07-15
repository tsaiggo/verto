import { expect, test, type Page } from "playwright/test";
import {
  expectReaderScrollBehavior,
  expectWorkbenchGeometry,
  measureReaderScroll,
  measureWorkbench,
  scrollReaderTo,
} from "./helpers/workbench-geometry";

const desktopWidths = [1024, 1280, 1440];
const routes = ["/", "/library", "/read/demo"];

async function waitForReadyWorkbench(page: Page, route: string) {
  await page.goto(route);
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(page.locator("[data-page-identity]")).toBeVisible();
  await expect(page.locator("[data-page-tabs], .app-tabs")).toBeVisible();
  await expect(page.locator("[data-page-scroll]")).toBeVisible();

  if (route === "/") {
    await page.locator(".home-workbench").evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });
  }
}

for (const width of desktopWidths) {
  test.describe(`${width}px workbench geometry`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const route of routes) {
      test(`${route} follows the flat frame and route-specific page geometry`, async ({ page }) => {
        await waitForReadyWorkbench(page, route);
        const metrics = await measureWorkbench(page);
        expectWorkbenchGeometry(metrics, width, route === "/read/demo");
      });
    }
  });

  test.describe(`${width}px reader scrolling`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("scrolls the masthead with the reader while fixed chrome and TOC stay in place", async ({
      page,
    }) => {
      await waitForReadyWorkbench(page, "/read/demo");
      const before = await measureReaderScroll(page);
      await scrollReaderTo(page, 500);
      const after = await measureReaderScroll(page);
      expectReaderScrollBehavior(before, after, width);
    });
  });
}
