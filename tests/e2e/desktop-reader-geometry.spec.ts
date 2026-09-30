import { expect, test, type Page } from "playwright/test";

interface Rect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

interface ReaderMetrics {
  viewportWidth: number;
  rootScrollWidth: number;
  rail: Rect;
  topbar: Rect;
  tabs: Rect | null;
  main: Rect;
  layoutDisplay: string;
  scroll: Rect;
  document: Rect;
  article: Rect;
  toc: Rect | null;
  tocDisplay: string;
  compactTocDisplay: string;
}

const desktopWidths = [1024, 1280, 1440, 1600];

async function waitForReader(page: Page) {
  await page.goto("/read/demo");
  await expect(page.locator("[data-article]")).toBeVisible();
  await expect(page.locator("[data-reader-workbench]")).toHaveCount(1);
  await expect(
    page.locator("[data-reader-workbench]").filter({ has: page.locator("[data-article]") })
  ).toBeVisible();
  await expect(page.locator(".chat-col, [data-agent-slot], [data-agent-pane]")).toHaveCount(0);
}

async function measureReader(page: Page): Promise<ReaderMetrics> {
  return page.evaluate(() => {
    const required = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing Reader element: ${selector}`);
      return element;
    };
    const rectangle = (element: Element): Rect => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    };
    const toc = document.querySelector<HTMLElement>("[data-context-panel]");
    const compactToc = required("[data-reader-document] details");
    const tabs = document.querySelector<HTMLElement>(".app-tabs");

    return {
      viewportWidth: innerWidth,
      rootScrollWidth: document.documentElement.scrollWidth,
      rail: rectangle(required("[data-shell-rail]")),
      topbar: rectangle(required(".vx-topbar")),
      tabs: tabs ? rectangle(tabs) : null,
      main: rectangle(required("#main-content")),
      layoutDisplay: getComputedStyle(required("[data-reader-layout]")).display,
      scroll: rectangle(required("[data-page-scroll]")),
      document: rectangle(required("[data-reader-document]")),
      article: rectangle(required("[data-article]")),
      toc: toc ? rectangle(toc) : null,
      tocDisplay: toc ? getComputedStyle(toc).display : "missing",
      compactTocDisplay: getComputedStyle(compactToc).display,
    };
  });
}

function expectNear(actual: number, expected: number, tolerance = 1) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

for (const width of desktopWidths) {
  test.describe(`${width}px Reader geometry`, () => {
    test.use({ viewport: { width, height: width === 1280 ? 720 : 800 } });

    test("keeps the shell flat and gives the document a readable measure", async ({ page }) => {
      await waitForReader(page);
      const metrics = await measureReader(page);

      await expect(page.locator(".vx-desktop-chrome")).toHaveCount(0);
      expect(metrics.rootScrollWidth).toBeLessThanOrEqual(width + 1);
      expectNear(metrics.rail.width, 288);
      expectNear(metrics.topbar.height, 56);
      expectNear(metrics.rail.top, 0);
      expectNear(metrics.topbar.top, 0);
      expectNear(metrics.topbar.left, metrics.rail.right, 2);
      if (metrics.tabs) {
        expect(metrics.tabs.top).toBeGreaterThanOrEqual(metrics.topbar.top - 2);
        expect(metrics.tabs.bottom).toBeLessThanOrEqual(metrics.topbar.bottom + 2);
      }
      expectNear(metrics.scroll.top, metrics.topbar.bottom);
      expect(metrics.layoutDisplay).toBe("flex");
      expectNear(metrics.scroll.height, metrics.main.height, 2);
      expectNear(metrics.scroll.bottom, metrics.main.bottom, 2);
      await expect(page.locator("[data-article] p").first()).toBeInViewport({ ratio: 0.9 });
      expect(metrics.document.width).toBeGreaterThanOrEqual(500);
      expect(metrics.document.width).toBeLessThanOrEqual(760);
      expect(metrics.article.width).toBeLessThanOrEqual(760);
      expect(metrics.article.left).toBeGreaterThanOrEqual(metrics.document.left - 1);
      expect(metrics.article.right).toBeLessThanOrEqual(metrics.document.right + 1);
    });

    test("progressively exposes the TOC while keeping the article free of Agent panes", async ({
      page,
    }) => {
      await waitForReader(page);
      const metrics = await measureReader(page);

      if (width >= 1440) {
        expect(metrics.tocDisplay).toBe("block");
        expect(metrics.toc).not.toBeNull();
        expect(metrics.toc!.width).toBeGreaterThanOrEqual(216);
        expect(metrics.toc!.width).toBeLessThanOrEqual(232);
        expect(metrics.compactTocDisplay).toBe("none");
        expect(metrics.document.right).toBeLessThanOrEqual(metrics.toc!.left);
        expect(metrics.toc!.right).toBeLessThanOrEqual(width);
        return;
      }

      expect(metrics.tocDisplay).toBe("none");
      expect(metrics.compactTocDisplay).toBe("block");
      expect(metrics.document.right).toBeLessThanOrEqual(width);
      if (width >= 1280) expectNear(metrics.document.width, 760);
      await expect(page.getByRole("button", { name: "Open Agent" })).toHaveCount(0);
    });
  });
}

test.describe("Reader scrolling", () => {
  test.use({ viewport: { width: 1440, height: 800 } });

  test("scrolls only the article while TOC and chrome stay pinned", async ({ page }) => {
    await waitForReader(page);
    const before = await page.evaluate(() => {
      const top = (selector: string) =>
        document.querySelector<HTMLElement>(selector)!.getBoundingClientRect().top;
      return {
        article: top("[data-article]"),
        toc: top("[data-context-panel]"),
        rail: top("[data-shell-rail]"),
        topbar: top(".vx-topbar"),
        tabs: document.querySelector(".app-tabs") ? top(".app-tabs") : null,
      };
    });

    await page.locator("[data-page-scroll]").evaluate((element) => {
      element.scrollTop = 500;
    });

    const after = await page.evaluate(() => {
      const top = (selector: string) =>
        document.querySelector<HTMLElement>(selector)!.getBoundingClientRect().top;
      return {
        article: top("[data-article]"),
        toc: top("[data-context-panel]"),
        rail: top("[data-shell-rail]"),
        topbar: top(".vx-topbar"),
        tabs: document.querySelector(".app-tabs") ? top(".app-tabs") : null,
        windowScrollY: window.scrollY,
      };
    });

    expect(after.article).toBeLessThan(before.article - 400);
    expectNear(after.toc, before.toc, 2);
    expectNear(after.rail, before.rail);
    expectNear(after.topbar, before.topbar);
    if (before.tabs !== null && after.tabs !== null) expectNear(after.tabs, before.tabs);
    expect(after.windowScrollY).toBe(0);
    const visibleBodyParagraphs = await page
      .locator("[data-article] p")
      .evaluateAll((paragraphs) => {
        const scroll = document.querySelector<HTMLElement>("[data-page-scroll]")!;
        const viewport = scroll.getBoundingClientRect();
        return paragraphs.filter((paragraph) => {
          const rect = paragraph.getBoundingClientRect();
          return rect.top >= viewport.top && rect.bottom <= viewport.bottom && rect.height > 0;
        }).length;
      });
    expect(visibleBodyParagraphs).toBeGreaterThan(0);
  });
});
