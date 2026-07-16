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

function workbenchSurface(route: string) {
  if (route === "/") return "home" as const;
  if (route === "/read/demo") return "reader" as const;
  return "collection" as const;
}

async function waitForReadyWorkbench(page: Page, route: string) {
  await page.goto(route);
  await expect(page.locator("#main-content")).toBeVisible();
  const scrollOwner = page.locator("[data-page-scroll]:visible");
  await expect(scrollOwner).toHaveCount(1);
  await expect(scrollOwner).toBeVisible();

  if (route === "/") {
    await expect(page.locator(".codex-home-composer")).toBeVisible();
    await expect(page.locator("[data-page-identity]")).toHaveCount(0);
    await expect(page.locator("[data-page-tabs], .app-tabs")).toHaveCount(0);
    await page.locator(".home-workbench").evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });
  } else {
    await expect(page.locator("[data-page-identity]")).toBeVisible();
    await expect(page.locator("[data-page-tabs], .app-tabs")).toBeVisible();
  }
}

async function measureDesktopMasthead(page: Page) {
  return page.locator(".doc-header").evaluate((header) => {
    const required = (selector: string) => {
      const element = header.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing masthead element: ${selector}`);
      return element;
    };
    const center = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      return (rect.left + rect.right) / 2;
    };
    const headerElement = header as HTMLElement;
    const title = required(".doc-title");
    const dek = required(".doc-dek");
    const alignedRows = [
      ".doc-eyebrow",
      ".doc-title-row",
      ".doc-authorline",
      ".doc-tags",
      ".doc-top",
    ];

    return {
      headerCenter: center(headerElement),
      titleCenter: center(title),
      dekCenter: center(dek),
      headerTextAlign: getComputedStyle(headerElement).textAlign,
      titleTextAlign: getComputedStyle(title).textAlign,
      dekTextAlign: getComputedStyle(dek).textAlign,
      paddingBottom: Number.parseFloat(getComputedStyle(headerElement).paddingBottom),
      rowJustification: alignedRows.map((selector) => ({
        selector,
        justifyContent: getComputedStyle(required(selector)).justifyContent,
      })),
    };
  });
}

for (const width of desktopWidths) {
  test.describe(`${width}px workbench geometry`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const route of routes) {
      test(`${route} follows the flat frame and route-specific page geometry`, async ({ page }) => {
        await waitForReadyWorkbench(page, route);
        const metrics = await measureWorkbench(page);
        expectWorkbenchGeometry(metrics, width, workbenchSurface(route));
      });
    }
  });

  test.describe(`${width}px reader scrolling`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("centers the editorial masthead at desktop widths", async ({ page }) => {
      await waitForReadyWorkbench(page, "/read/demo");
      const masthead = await measureDesktopMasthead(page);

      expect(masthead.headerTextAlign).toBe("center");
      expect(masthead.titleTextAlign).toBe("center");
      expect(masthead.dekTextAlign).toBe("center");
      expect(masthead.paddingBottom).toBe(42);
      expect(Math.abs(masthead.titleCenter - masthead.headerCenter)).toBeLessThanOrEqual(1);
      expect(Math.abs(masthead.dekCenter - masthead.headerCenter)).toBeLessThanOrEqual(1);
      for (const row of masthead.rowJustification) {
        expect(row.justifyContent, row.selector).toBe("center");
      }
    });

    test("scrolls the masthead while the rail, task bar, tabs, and TOC stay in place", async ({
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
