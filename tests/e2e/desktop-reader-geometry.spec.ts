import { expect, test, type Page } from "playwright/test";

interface Rect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

const desktopWidths = [1024, 1280, 1440, 1600];
const navigator = (page: Page) => page.locator('aside[aria-label="Document navigation"]');
const toggle = (page: Page) => page.getByRole("button", { name: "Toggle document navigation" });
const reader = (page: Page) => page.locator('[data-page-scroll][data-reader-state="ready"]');

async function waitForReader(page: Page) {
  await page.goto("/read/demo");
  await expect(page.locator("[data-article]")).toBeVisible();
  await expect(reader(page)).toHaveCount(1);
  await expect(page.locator("[data-reader-workbench]")).toHaveCount(1);
  await expect(page.locator(".chat-col, [data-agent-slot], [data-agent-pane]")).toHaveCount(0);
  await expect(page.locator("[data-context-panel]")).toHaveCount(0);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(navigator(page)).toBeHidden();
}

async function measureReader(page: Page) {
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
    const nav = required('aside[aria-label="Document navigation"]');
    return {
      rootScrollWidth: document.documentElement.scrollWidth,
      rail: rectangle(required("[data-shell-rail]")),
      topbar: rectangle(required(".vx-topbar")),
      main: rectangle(required("#main-content")),
      navigationTools: rectangle(required("[data-document-navigation-tools]")),
      scroll: rectangle(required('[data-page-scroll][data-reader-state="ready"]')),
      scrollContentCenter:
        required('[data-page-scroll][data-reader-state="ready"]').getBoundingClientRect().left +
        required('[data-page-scroll][data-reader-state="ready"]').clientLeft +
        required('[data-page-scroll][data-reader-state="ready"]').clientWidth / 2,
      document: rectangle(required("[data-reader-document]")),
      article: rectangle(required("[data-article]")),
      navigation: rectangle(nav),
      navigationHidden: nav.hidden,
    };
  });
}

function expectNear(actual: number, expected: number, tolerance = 1) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

for (const width of desktopWidths) {
  test.describe(`${width}px Reader geometry`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("keeps the Sidebar and gives the reading pane a comfortable measure", async ({ page }) => {
      await waitForReader(page);
      const metrics = await measureReader(page);

      await expect(page.locator(".vx-desktop-chrome")).toHaveCount(0);
      expect(metrics.rootScrollWidth).toBeLessThanOrEqual(width + 1);
      expectNear(metrics.rail.width, 288);
      expectNear(metrics.topbar.height, 56);
      expectNear(metrics.rail.top, 0);
      expectNear(metrics.topbar.top, 0);
      expectNear(metrics.topbar.left, metrics.rail.right, 2);
      expectNear(metrics.navigationTools.top, metrics.topbar.bottom);
      expectNear(metrics.navigationTools.left, metrics.scroll.left);
      expectNear(metrics.navigationTools.right, metrics.scroll.right);
      expectNear(metrics.scroll.top, metrics.navigationTools.bottom);
      expectNear(metrics.scroll.height + metrics.navigationTools.height, metrics.main.height, 2);
      expectNear(metrics.scroll.bottom, metrics.main.bottom, 2);
      expect(metrics.document.width).toBeGreaterThanOrEqual(500);
      expect(metrics.document.width).toBeLessThanOrEqual(840);
      expect(metrics.article.width).toBeLessThanOrEqual(840);
      expect(metrics.article.left).toBeGreaterThanOrEqual(metrics.document.left - 1);
      expect(metrics.article.right).toBeLessThanOrEqual(metrics.document.right + 1);
      await expect(page.locator("[data-article] p").first()).toBeInViewport({ ratio: 0.9 });

      expect(metrics.navigationHidden).toBe(true);
      expectNear(metrics.scroll.left, metrics.rail.right);
      expectNear(
        metrics.document.left + metrics.document.width / 2,
        metrics.scrollContentCenter,
        2
      );
      if (width >= 1280) expectNear(metrics.document.width, 840);
    });
  });
}

test.describe("Reading focus and independent scrolling", () => {
  test.use({ viewport: { width: 1440, height: 800 } });

  test("keeps navigation and chrome pinned while only the article scrolls", async ({ page }) => {
    await waitForReader(page);
    await toggle(page).click();
    await expect(navigator(page)).toBeVisible();
    const before = await measureReader(page);
    await reader(page).evaluate((element) => {
      element.scrollTop = 500;
    });
    const after = await measureReader(page);

    expect(after.article.top).toBeLessThan(before.article.top - 400);
    expectNear(after.navigation.top, before.navigation.top);
    expectNear(after.navigation.bottom, before.navigation.bottom);
    expectNear(after.rail.top, before.rail.top);
    expectNear(after.topbar.top, before.topbar.top);
    expectNear(after.navigationTools.top, before.navigationTools.top);
    expectNear(after.navigationTools.bottom, before.navigationTools.bottom);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("offers keyboard focus mode without moving the reading passage", async ({ page }) => {
    await waitForReader(page);
    await toggle(page).click();
    await expect(navigator(page)).toBeVisible();
    const scrollTop = await reader(page).evaluate((element) => {
      element.scrollTop = 420;
      return element.scrollTop;
    });
    expect(scrollTop).toBeGreaterThan(0);
    const passageIndex = await page.locator("[data-article] p").evaluateAll((paragraphs) => {
      const scroll = document
        .querySelector<HTMLElement>("[data-page-scroll]")!
        .getBoundingClientRect();
      return paragraphs.findIndex((paragraph) => {
        const bounds = paragraph.getBoundingClientRect();
        return bounds.top >= scroll.top && bounds.bottom <= scroll.bottom;
      });
    });
    expect(passageIndex).toBeGreaterThanOrEqual(0);
    const passage = page.locator("[data-article] p").nth(passageIndex);
    const passageTop = await passage.evaluate((element) => element.getBoundingClientRect().top);
    await toggle(page).focus();
    await expect(toggle(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
    await expect(navigator(page)).toBeHidden();
    const focused = await measureReader(page);
    expectNear(focused.scroll.left, focused.rail.right);
    expectNear(focused.document.width, 840);
    expectNear(focused.document.left + focused.document.width / 2, focused.scrollContentCenter, 2);
    await expect
      .poll(() =>
        passage.evaluate(
          (element, top) => Math.abs(element.getBoundingClientRect().top - top),
          passageTop
        )
      )
      .toBeLessThanOrEqual(2);

    await page.keyboard.press("Space");
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
    await expect(navigator(page)).toBeVisible();
    await expect
      .poll(() =>
        passage.evaluate(
          (element, top) => Math.abs(element.getBoundingClientRect().top - top),
          passageTop
        )
      )
      .toBeLessThanOrEqual(2);
  });

  test("keeps the same reading composition in dark mode", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
    await waitForReader(page);
    await expect(page.locator("html")).toHaveClass(/dark/);
    expectNear((await measureReader(page)).document.width, 840);
    await toggle(page).click();
    await expect(navigator(page)).toBeVisible();
    const initial = await measureReader(page);
    expectNear(initial.navigation.width, 272);
    expect(initial.document.width).toBeLessThanOrEqual(840);
    await toggle(page).click();
    await expect(navigator(page)).toBeHidden();
    await expect(page.getByRole("button", { name: "Reading settings" })).toBeEnabled();
    await expect(page.locator("[data-article]")).toBeVisible();
  });

  test("scrolls a real local document list independently and opens a document using the keyboard", async ({
    page,
  }) => {
    await page.goto("/library");
    await expect(page.getByLabel("Import EPUB or PDF file")).toBeAttached();
    await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("verto.articles");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction("articles", "readwrite");
          for (let index = 0; index < 18; index++) {
            const date = new Date(Date.UTC(2026, 8, 30, 12, 0, 0) - index * 1000).toISOString();
            const title = index === 0 ? "A reading workspace" : `Field note ${index}`;
            transaction.objectStore("articles").put({
              id: `reader-navigation-${index}`,
              filename: `field-note-${index}.mdx`,
              source: `---\ntitle: ${title}\n---\n# ${title}\n\n${Array.from(
                { length: 28 },
                (_, paragraph) =>
                  `## Observation ${paragraph + 1}\n\nReading connects the original source with our own ideas. Keep this paragraph beside its notes and return to the document without losing your place.\n`
              ).join("\n")}`,
              createdAt: date,
              updatedAt: date,
              revision: 1,
              status: "saved",
            });
          }
          transaction.oncomplete = () => resolve();
          transaction.onerror = transaction.onabort = () => reject(transaction.error);
        });
      } finally {
        database.close();
      }
    });
    await page.goto("/read/local?document=reader-navigation-0");
    await expect(
      page.getByRole("heading", { name: "A reading workspace", exact: true })
    ).toBeVisible();
    await expect(navigator(page)).toBeHidden();
    await toggle(page).click();
    await expect(navigator(page)).toBeVisible();
    const list = navigator(page).locator("[data-document-navigation-scroll]");
    await expect(list).toBeVisible();
    const bodyScroll = await reader(page).evaluate((element) => {
      element.scrollTop = 320;
      return element.scrollTop;
    });
    expect(bodyScroll).toBeGreaterThan(0);
    const listScroll = await list.evaluate((element) => {
      element.scrollTop = 700;
      return element.scrollTop;
    });
    expect(listScroll).toBeGreaterThan(400);
    expectNear(await reader(page).evaluate((element) => element.scrollTop), bodyScroll);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    const next = navigator(page).getByRole("link", { name: /Field note 2\b/ });
    await next.focus();
    await expect(next).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/read\/local\?document=reader-navigation-2$/);
    await expect(page.getByRole("heading", { name: "Field note 2", exact: true })).toBeVisible();
    await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
    await expect(navigator(page)).toBeVisible();
    await expect(navigator(page).getByRole("link", { name: /Field note 2\b/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
    for (const route of ["/read/local", "/editor"]) {
      await page.goto(`${route}?document=reader-navigation-17`);
      await expect(page.getByRole("heading", { name: "Field note 17", exact: true })).toBeVisible();
      if (route === "/read/local") {
        await expect(navigator(page)).toBeHidden();
        await toggle(page).click();
      }
      const current = navigator(page).getByRole("link", { name: /Field note 17\b/ });
      await expect(current).toHaveAttribute("aria-current", "page");
      await expect(current).toBeInViewport({ ratio: 0.95 });
      expect(
        await navigator(page)
          .locator("[data-document-navigation-scroll]")
          .evaluate((element) => element.scrollTop)
      ).toBeGreaterThan(0);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
    }
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("/read/local?document=reader-navigation-17");
    await expect(page.getByRole("heading", { name: "Field note 17", exact: true })).toBeVisible();
    await expect(navigator(page)).toBeHidden();
    await toggle(page).click();
    await expect(navigator(page).getByRole("link", { name: /Field note 17\b/ })).toBeInViewport({
      ratio: 0.95,
    });
  });
});

test("lets a narrow desktop explicitly open and close its document navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await waitForReader(page);
  await toggle(page).click();
  await expect(navigator(page)).toBeVisible();
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
  expect((await measureReader(page)).rootScrollWidth).toBeLessThanOrEqual(1025);
  await toggle(page).click();
  await expect(navigator(page)).toBeHidden();
  await expect(page.locator("[data-article]")).toBeVisible();
});
