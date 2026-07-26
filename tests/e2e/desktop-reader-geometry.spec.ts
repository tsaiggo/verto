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
  chrome: Rect;
  rail: Rect;
  topbar: Rect;
  tabs: Rect;
  scroll: Rect;
  document: Rect;
  article: Rect;
  toc: Rect | null;
  tocDisplay: string;
  compactTocDisplay: string;
  agent: Rect;
  agentDisplay: string;
  agentHidden: string | null;
}

const desktopWidths = [1024, 1280, 1440, 1600];

async function waitForReader(page: Page) {
  await page.goto("/read/demo");
  await expect(page.locator("[data-article]")).toBeVisible();
  await expect(page.locator("[data-reader-workbench]")).toHaveCount(1);
  await expect(
    page.locator("[data-reader-workbench]").filter({ has: page.locator("[data-article]") })
  ).toBeVisible();
  await expect(page.locator(".chat-col")).toHaveAttribute("data-ready", "true");
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
    const agent = required(".chat-col");
    const compactToc = required("details");

    return {
      viewportWidth: innerWidth,
      rootScrollWidth: document.documentElement.scrollWidth,
      chrome: rectangle(required(".vx-desktop-chrome")),
      rail: rectangle(required("[data-shell-rail]")),
      topbar: rectangle(required(".vx-topbar")),
      tabs: rectangle(required(".app-tabs")),
      scroll: rectangle(required("[data-page-scroll]")),
      document: rectangle(required("[data-reader-document]")),
      article: rectangle(required("[data-article]")),
      toc: toc ? rectangle(toc) : null,
      tocDisplay: toc ? getComputedStyle(toc).display : "missing",
      compactTocDisplay: getComputedStyle(compactToc).display,
      agent: rectangle(agent),
      agentDisplay: getComputedStyle(agent).display,
      agentHidden: agent.getAttribute("aria-hidden"),
    };
  });
}

function expectNear(actual: number, expected: number, tolerance = 1) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

for (const width of desktopWidths) {
  test.describe(`${width}px Reader geometry`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("keeps the shell flat and gives the document a readable measure", async ({ page }) => {
      await waitForReader(page);
      const metrics = await measureReader(page);

      expect(metrics.rootScrollWidth).toBeLessThanOrEqual(width + 1);
      expectNear(metrics.chrome.height, 44);
      expectNear(metrics.rail.width, 64);
      expectNear(metrics.topbar.height, 48);
      expectNear(metrics.tabs.height, 40);
      expectNear(metrics.rail.top, metrics.chrome.bottom);
      expectNear(metrics.topbar.left, metrics.rail.right, 2);
      expectNear(metrics.tabs.top, metrics.topbar.bottom);
      expectNear(metrics.scroll.top, metrics.tabs.bottom);
      expect(metrics.document.width).toBeLessThanOrEqual(761);
      expect(metrics.article.width).toBeLessThanOrEqual(761);
      expect(metrics.article.left).toBeGreaterThanOrEqual(metrics.document.left - 1);
      expect(metrics.article.right).toBeLessThanOrEqual(metrics.document.right + 1);
    });

    test("progressively exposes the TOC and Agent without overlap", async ({ page }) => {
      await waitForReader(page);
      const metrics = await measureReader(page);

      if (width >= 1440) {
        expect(metrics.document.width).toBeGreaterThanOrEqual(720);
        expect(metrics.document.width).toBeLessThanOrEqual(780);
        expect(metrics.tocDisplay).toBe("block");
        expect(metrics.toc).not.toBeNull();
        expect(metrics.toc!.width).toBeGreaterThanOrEqual(216);
        expect(metrics.toc!.width).toBeLessThanOrEqual(232);
        expect(metrics.compactTocDisplay).toBe("none");
        expect(metrics.agentDisplay).toBe("flex");
        expect(metrics.agentHidden).toBe("false");
        expect(metrics.agent.width).toBeGreaterThanOrEqual(340);
        expect(metrics.agent.width).toBeLessThanOrEqual(360);
        expect(metrics.document.right).toBeLessThanOrEqual(metrics.toc!.left);
        expect(metrics.toc!.right).toBeLessThanOrEqual(metrics.agent.left);
        return;
      }

      expect(metrics.tocDisplay).toBe("none");
      expect(metrics.compactTocDisplay).toBe("block");
      if (width >= 1280) {
        expect(metrics.agentDisplay).toBe("flex");
        expect(metrics.agentHidden).toBe("false");
        expect(metrics.agent.width).toBeGreaterThanOrEqual(340);
        expect(metrics.agent.width).toBeLessThanOrEqual(360);
        expect(metrics.document.right).toBeLessThanOrEqual(metrics.agent.left);
      } else {
        expect(metrics.agentHidden).toBe("true");
        await expect(page.getByRole("button", { name: "Open Agent" })).toBeVisible();
      }
    });
  });
}

test.describe("Reader scrolling", () => {
  test.use({ viewport: { width: 1440, height: 800 } });

  test("scrolls only the article while TOC, Agent, and chrome stay pinned", async ({ page }) => {
    await waitForReader(page);
    const before = await page.evaluate(() => {
      const top = (selector: string) =>
        document.querySelector<HTMLElement>(selector)!.getBoundingClientRect().top;
      return {
        article: top("[data-article]"),
        toc: top("[data-context-panel]"),
        agent: top(".chat-col"),
        rail: top("[data-shell-rail]"),
        topbar: top(".vx-topbar"),
        tabs: top(".app-tabs"),
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
        agent: top(".chat-col"),
        rail: top("[data-shell-rail]"),
        topbar: top(".vx-topbar"),
        tabs: top(".app-tabs"),
        windowScrollY: window.scrollY,
      };
    });

    expect(after.article).toBeLessThan(before.article - 400);
    expectNear(after.toc, before.toc, 2);
    expectNear(after.agent, before.agent, 2);
    expectNear(after.rail, before.rail);
    expectNear(after.topbar, before.topbar);
    expectNear(after.tabs, before.tabs);
    expect(after.windowScrollY).toBe(0);
  });
});
