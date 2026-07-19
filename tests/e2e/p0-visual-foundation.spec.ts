import { expect, test, type Page } from "playwright/test";

const desktopWidths = [1280, 1440, 1600] as const;
const assistantKind = (process.env.NEXT_PUBLIC_VERTO_ASSISTANT ?? "").trim().toLowerCase();
const assistantEnabled = ["github", "copilot", "github-models", "mock"].includes(assistantKind);

const FOUNDATION = {
  railWidth: 240,
  paneHeaderHeight: 38,
  navRowHeight: 32,
  navTextSize: 14,
  navIconSize: 16,
  readerOuterMaxWidth: 800,
  readerHorizontalPadding: 40,
  readerContentMaxWidth: 720,
  contextWidth: 304,
  contextTolerance: 16,
} as const;

async function waitForFonts(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

async function openReadyRoute(page: Page, route: string) {
  await page.goto(route);
  await expect(page.locator("#main-content")).toBeVisible();
  await waitForFonts(page);
}

function registerShellFoundationTest() {
  test("keeps desktop rail, pane header, and primary navigation at fixed physical sizes", async ({
    page,
  }) => {
    await openReadyRoute(page, "/library");
    const metrics = await page.evaluate(() => {
      const required = <T extends Element>(selector: string): T => {
        const element = document.querySelector<T>(selector);
        if (!element) throw new Error("Missing visual-foundation element: " + selector);
        return element;
      };
      const rail = required<HTMLElement>("[data-shell-rail]");
      const header = required<HTMLElement>(".vx-topbar.codex-task-bar");
      const navRow = required<HTMLElement>(
        '[data-shell-rail] .codex-primary-nav .vx-nav-item[href="/library"]'
      );
      const navLabel = required<HTMLElement>(
        '[data-shell-rail] .codex-primary-nav .vx-nav-item[href="/library"] .vx-nav-label'
      );
      const navIcon = required<SVGElement>(
        '[data-shell-rail] .codex-primary-nav .vx-nav-item[href="/library"] .vx-nav-icon'
      );
      const railRect = rail.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const rowRect = navRow.getBoundingClientRect();
      const iconRect = navIcon.getBoundingClientRect();

      return {
        railWidth: railRect.width,
        headerHeight: headerRect.height,
        headerComputedHeight: Number.parseFloat(getComputedStyle(header).height),
        rowHeight: rowRect.height,
        rowFontSize: Number.parseFloat(getComputedStyle(navRow).fontSize),
        labelFontSize: Number.parseFloat(getComputedStyle(navLabel).fontSize),
        iconWidth: iconRect.width,
        iconHeight: iconRect.height,
        rootClientWidth: document.documentElement.clientWidth,
        rootScrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(metrics.railWidth).toBeCloseTo(FOUNDATION.railWidth, 0);
    expect(metrics.headerHeight).toBeCloseTo(FOUNDATION.paneHeaderHeight, 0);
    expect(metrics.headerComputedHeight).toBeCloseTo(FOUNDATION.paneHeaderHeight, 0);
    expect(metrics.rowHeight).toBeCloseTo(FOUNDATION.navRowHeight, 0);
    expect(metrics.rowFontSize).toBeCloseTo(FOUNDATION.navTextSize, 1);
    expect(metrics.labelFontSize).toBeCloseTo(FOUNDATION.navTextSize, 1);
    expect(metrics.iconWidth).toBeCloseTo(FOUNDATION.navIconSize, 0);
    expect(metrics.iconHeight).toBeCloseTo(FOUNDATION.navIconSize, 0);
    expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
  });
}

function registerReaderMeasureTest() {
  test("keeps the Reader measure narrow and reserves one stable context panel", async ({
    page,
  }) => {
    await openReadyRoute(page, "/read/demo");
    await expect(page.locator("[data-article]")).toBeVisible();
    await expect(page.locator("[data-reader-toc-surface]")).toBeVisible();
    const metrics = await page.evaluate(() => {
      const required = <T extends Element>(selector: string): T => {
        const element = document.querySelector<T>(selector);
        if (!element) throw new Error("Missing Reader foundation element: " + selector);
        return element;
      };
      const article = required<HTMLElement>("[data-article]");
      const main = required<HTMLElement>(".reader-workbench > .main");
      const context = required<HTMLElement>("[data-context-panel]");
      const toc = required<HTMLElement>("[data-reader-toc-surface]");
      const articleRect = article.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const contextRect = context.getBoundingClientRect();
      const tocRect = toc.getBoundingClientRect();
      const articleStyle = getComputedStyle(article);
      const paddingLeft = Number.parseFloat(articleStyle.paddingLeft);
      const paddingRight = Number.parseFloat(articleStyle.paddingRight);

      return {
        articleLeft: articleRect.left,
        articleRight: articleRect.right,
        articleOuterWidth: articleRect.width,
        articleContentWidth: article.clientWidth - paddingLeft - paddingRight,
        paddingLeft,
        paddingRight,
        mainLeft: mainRect.left,
        mainRight: mainRect.right,
        contextLeft: contextRect.left,
        contextRight: contextRect.right,
        contextWidth: contextRect.width,
        tocLeft: tocRect.left,
        tocRight: tocRect.right,
        rootClientWidth: document.documentElement.clientWidth,
        rootScrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(metrics.articleOuterWidth).toBeLessThanOrEqual(FOUNDATION.readerOuterMaxWidth + 1);
    expect(metrics.articleContentWidth).toBeGreaterThanOrEqual(480);
    expect(metrics.articleContentWidth).toBeLessThanOrEqual(FOUNDATION.readerContentMaxWidth + 1);
    expect(metrics.paddingLeft).toBeCloseTo(FOUNDATION.readerHorizontalPadding, 0);
    expect(metrics.paddingRight).toBeCloseTo(FOUNDATION.readerHorizontalPadding, 0);
    expect(metrics.articleLeft).toBeGreaterThanOrEqual(metrics.mainLeft - 1);
    expect(metrics.articleRight).toBeLessThanOrEqual(metrics.mainRight + 1);
    expect(metrics.contextWidth).toBeGreaterThanOrEqual(
      FOUNDATION.contextWidth - FOUNDATION.contextTolerance
    );
    expect(metrics.contextWidth).toBeLessThanOrEqual(
      FOUNDATION.contextWidth + FOUNDATION.contextTolerance
    );
    expect(metrics.contextLeft).toBeGreaterThanOrEqual(metrics.mainRight);
    expect(metrics.tocLeft).toBeGreaterThanOrEqual(metrics.contextLeft - 1);
    expect(metrics.tocRight).toBeLessThanOrEqual(metrics.contextRight + 1);
    expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
  });
}

function registerContextSwapTest() {
  test("uses the context column for either TOC or Reading Companion, never both", async ({
    page,
  }) => {
    test.skip(!assistantEnabled, "Requires an enabled reading companion provider.");
    await openReadyRoute(page, "/read/demo");

    const context = page.locator("[data-context-panel]");
    const main = page.locator(".reader-workbench > .main");
    const tools = context.locator("[data-reader-tools]");
    const toc = tools.locator("[data-reader-toc-surface]");
    const panelHost = tools.locator("[data-reading-companion-panel-host]");
    const launcher = tools
      .locator("[data-reading-companion-launcher-host]")
      .getByRole("button", { name: "Open reading companion" });

    await expect(context).toBeVisible();
    await expect(toc).toBeVisible();
    await expect(launcher).toBeVisible();
    const contextBefore = await context.boundingBox();
    const mainBefore = await main.boundingBox();
    if (!contextBefore || !mainBefore) throw new Error("Reader columns are not measurable");

    await launcher.click();
    const companion = panelHost.getByRole("region", { name: "Reading companion" });
    await expect(companion).toBeVisible();
    await expect(toc).toBeHidden();
    await expect(page.getByRole("dialog", { name: "Reading companion" })).toHaveCount(0);

    const contextAfter = await context.boundingBox();
    const mainAfter = await main.boundingBox();
    const companionBox = await companion.boundingBox();
    if (!contextAfter || !mainAfter || !companionBox) {
      throw new Error("Reading Companion did not occupy the desktop context column");
    }

    expect(contextAfter.x).toBeCloseTo(contextBefore.x, 0);
    expect(contextAfter.width).toBeCloseTo(contextBefore.width, 0);
    expect(mainAfter.x).toBeCloseTo(mainBefore.x, 0);
    expect(mainAfter.width).toBeCloseTo(mainBefore.width, 0);
    expect(companionBox.x).toBeGreaterThanOrEqual(contextAfter.x - 1);
    expect(companionBox.x + companionBox.width).toBeLessThanOrEqual(
      contextAfter.x + contextAfter.width + 1
    );
    expect(companionBox.x).toBeGreaterThanOrEqual(mainAfter.x + mainAfter.width);

    await companion.getByRole("button", { name: "Back to contents" }).click();
    await expect(companion).toBeHidden();
    await expect(toc).toBeVisible();
    await expect(launcher).toBeFocused();
  });
}

for (const width of desktopWidths) {
  test.describe(String(width) + "px P0 visual foundation", () => {
    test.use({ colorScheme: "light", viewport: { width, height: 900 } });
    registerShellFoundationTest();
    registerReaderMeasureTest();
    registerContextSwapTest();
  });
}
