import { expect, type Page } from "playwright/test";

interface RectMetrics {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

interface WorkbenchMetrics {
  viewport: { width: number; height: number };
  rootScrollWidth: number;
  shell: RectMetrics;
  rail: RectMetrics;
  surface: RectMetrics;
  topbar: RectMetrics;
  topbarDisplay: string;
  identity: RectMetrics | null;
  tabs: RectMetrics | null;
  scroll: RectMetrics;
  article: RectMetrics | null;
  composer: RectMetrics | null;
  composerSearch: RectMetrics | null;
  homeWorkbench: RectMetrics | null;
  scrollClientWidth: number;
  scrollContentRight: number;
  context: RectMetrics | null;
  contextDisplay: string;
  main: RectMetrics;
  borderTopWidth: string;
  borderLeftWidth: string;
  borderTopLeftRadius: number;
  borderBottomLeftRadius: number;
  boxShadow: string;
  overflow: string;
  contentClientWidth: number;
  contentScrollWidth: number;
  mobileMenuDisplay: string;
}

interface ReaderScrollMetrics {
  windowScrollY: number;
  bodyScrollTop: number;
  railTop: number;
  topbarTop: number;
  identityTop: number;
  tabsTop: number;
  scrollTop: number;
  contextTop: number;
  contextLeft: number;
  clientHeight: number;
  scrollHeight: number;
}

const FRAME = {
  identityHeight: 104,
  tabsHeight: 40,
  pageTopPadding: 29,
  pageRightPadding: 43,
  columnGap: 32,
  minimumContextWidth: 304,
  columnRatio: 2.18,
  readerTopPadding: 38,
  readerMaxWidth: 820,
} as const;

export type WorkbenchSurface = "home" | "collection" | "reader";

export async function measureWorkbench(page: Page): Promise<WorkbenchMetrics> {
  return page.evaluate(() => {
    const required = <T extends Element>(selector: string): T => {
      const candidates = [...document.querySelectorAll<T>(selector)];
      const element =
        candidates.find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }) ?? candidates[0];
      if (!element) throw new Error(`Missing required workbench element: ${selector}`);
      return element;
    };
    const rectangle = (element: Element): RectMetrics => {
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
    const optionalRectangle = (selector: string) => {
      const element = [...document.querySelectorAll<HTMLElement>(selector)].find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      return element ? rectangle(element) : null;
    };

    const surface = required<HTMLElement>("[data-work-surface]");
    const scroll = required<HTMLElement>("[data-page-scroll]");
    const content = required<HTMLElement>("#main-content");
    const main = required<HTMLElement>(".home-feed, .lib-main, .reader-workbench > .main");
    const context = document.querySelector<HTMLElement>("[data-context-panel]");
    const article = document.querySelector<HTMLElement>("[data-article]");
    const surfaceStyle = getComputedStyle(surface);
    const scrollRect = scroll.getBoundingClientRect();

    return {
      viewport: { width: innerWidth, height: innerHeight },
      rootScrollWidth: document.documentElement.scrollWidth,
      shell: rectangle(required("[data-shell-root]")),
      rail: rectangle(required("[data-shell-rail]")),
      surface: rectangle(surface),
      topbar: rectangle(required("[data-work-surface] .vx-topbar")),
      topbarDisplay: getComputedStyle(required("[data-work-surface] .vx-topbar")).display,
      identity: optionalRectangle("[data-page-identity]"),
      tabs: optionalRectangle("[data-page-tabs], .app-tabs"),
      scroll: rectangle(scroll),
      article: article ? rectangle(article) : null,
      composer: optionalRectangle(".codex-home-composer"),
      composerSearch: optionalRectangle(".codex-home-search"),
      homeWorkbench: optionalRectangle(".home-workbench"),
      scrollClientWidth: scroll.clientWidth,
      scrollContentRight: scrollRect.left + scroll.clientLeft + scroll.clientWidth,
      context: context ? rectangle(context) : null,
      contextDisplay: context ? getComputedStyle(context).display : "missing",
      main: rectangle(main),
      borderTopWidth: surfaceStyle.borderTopWidth,
      borderLeftWidth: surfaceStyle.borderLeftWidth,
      borderTopLeftRadius: Number.parseFloat(surfaceStyle.borderTopLeftRadius),
      borderBottomLeftRadius: Number.parseFloat(surfaceStyle.borderBottomLeftRadius),
      boxShadow: surfaceStyle.boxShadow,
      overflow: surfaceStyle.overflow,
      contentClientWidth: content.clientWidth,
      contentScrollWidth: content.scrollWidth,
      mobileMenuDisplay: getComputedStyle(required(".vx-topbar-menu")).display,
    };
  });
}

export function expectWorkbenchGeometry(
  metrics: WorkbenchMetrics,
  viewportWidth: number,
  surface: WorkbenchSurface
) {
  expectFlatFrame(metrics, viewportWidth, surface);
  if (surface === "home") {
    expectHomeGeometry(metrics, viewportWidth);
  } else if (surface === "reader") {
    expectReaderGeometry(metrics, viewportWidth);
  } else {
    expectCollectionGeometry(metrics, viewportWidth);
  }
}

function expectFlatFrame(
  metrics: WorkbenchMetrics,
  viewportWidth: number,
  surface: WorkbenchSurface
) {
  expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.viewport.width + 1);
  expect(metrics.mobileMenuDisplay).toBe("none");
  expect(metrics.borderTopWidth).toBe("0px");
  expect(metrics.borderLeftWidth).toBe("0px");
  expect(metrics.boxShadow).not.toBe("none");
  expect(metrics.overflow).toBe("hidden");
  expectPx(metrics.borderTopLeftRadius, workspaceRadius(viewportWidth));
  expectPx(metrics.borderBottomLeftRadius, 0);

  expectPx(metrics.shell.top, 0);
  expectPx(metrics.shell.left, 0);
  expectPx(metrics.shell.right, metrics.viewport.width);
  expectPx(metrics.shell.bottom, metrics.viewport.height);
  expectPx(metrics.rail.top, 0);
  expectPx(metrics.rail.left, 0);
  expectPx(metrics.rail.width, railWidth(viewportWidth));
  expectPx(metrics.rail.bottom, metrics.viewport.height);

  expectPx(metrics.surface.left, metrics.rail.right);
  expectPx(metrics.surface.top, 0);
  expectPx(metrics.surface.right, metrics.viewport.width);
  expectPx(metrics.surface.bottom, metrics.viewport.height);

  expect(metrics.topbarDisplay).not.toBe("none");
  expectPx(metrics.topbar.left, metrics.surface.left);
  expectPx(metrics.topbar.right, metrics.surface.right);
  expectPx(metrics.topbar.top, metrics.surface.top);
  expectPx(metrics.topbar.height, paneHeaderHeight(viewportWidth));

  expectPx(metrics.scroll.left, metrics.topbar.left);
  expectPx(metrics.scroll.right, metrics.topbar.right);
  if (surface === "home") {
    expect(metrics.identity).toBeNull();
    expect(metrics.tabs).toBeNull();
    expectPx(metrics.scroll.top, metrics.topbar.bottom);
    expect(metrics.scroll.bottom).toBeLessThan(metrics.surface.bottom);
  } else {
    const tabs = metrics.tabs!;
    expect(tabs).not.toBeNull();
    expectPx(tabs.left, metrics.surface.left);
    expectPx(tabs.right, metrics.surface.right);
    expectPx(tabs.height, FRAME.tabsHeight);
    expectPx(metrics.scroll.top, tabs.bottom);
  }
  if (surface !== "home") {
    expectPx(metrics.scroll.bottom, metrics.surface.bottom);
  }
  expect(metrics.scrollClientWidth).toBeGreaterThan(0);
  expect(metrics.contentScrollWidth).toBeLessThanOrEqual(metrics.contentClientWidth + 1);
}

function expectHomeGeometry(metrics: WorkbenchMetrics, viewportWidth: number) {
  const composer = metrics.composer!;
  const search = metrics.composerSearch!;
  const workbench = metrics.homeWorkbench!;

  expect(composer).not.toBeNull();
  expect(search).not.toBeNull();
  expect(workbench).not.toBeNull();
  expect(metrics.context).toBeNull();
  expect(metrics.contextDisplay).toBe("missing");

  expectContained(composer, metrics.surface);
  expectContained(search, composer);
  expectHorizontallyContained(workbench, metrics.scroll);
  expectPx(
    (composer.left + composer.right) / 2,
    (metrics.surface.left + metrics.surface.right) / 2,
    2
  );
  expect(composer.width).toBeLessThanOrEqual(801);
  expect(composer.width).toBeGreaterThan(0);
  expectPx(search.left, composer.left);
  expectPx(search.right, composer.right);
  expectPx(search.bottom, composer.bottom);
  expectPx(metrics.scroll.bottom, composer.top - homeComposerGap(), 2);
  expectPx(metrics.surface.bottom - composer.bottom, homeComposerBottomInset(viewportWidth), 2);
  expectPx(
    (workbench.left + workbench.right) / 2,
    (metrics.scroll.left + metrics.scrollContentRight) / 2,
    2
  );
  expect(workbench.width).toBeLessThanOrEqual(801);
  expect(workbench.top).toBeGreaterThan(metrics.scroll.top);
  expectPx(metrics.main.left, workbench.left);
  expectPx(metrics.main.right, workbench.right);
}

function expectCollectionGeometry(metrics: WorkbenchMetrics, viewportWidth: number) {
  const identity = metrics.identity!;
  const tabs = metrics.tabs!;
  const inlinePadding = pageInlinePadding(viewportWidth);
  expect(identity).not.toBeNull();
  expectPx(identity.left, metrics.topbar.left);
  expectPx(identity.right, metrics.topbar.right);
  expectPx(identity.top, metrics.topbar.bottom);
  expectPx(identity.height, FRAME.identityHeight);
  expectPx(tabs.top, identity.bottom);
  expectPx(metrics.main.left, metrics.scroll.left + inlinePadding);
  expectPx(metrics.main.top, metrics.scroll.top + FRAME.pageTopPadding, 2);

  if (viewportWidth < 1200) {
    expect(metrics.contextDisplay).toBe("none");
    expectPx(metrics.context?.width ?? 0, 0);
    expectPx(metrics.main.right, metrics.scrollContentRight - FRAME.pageRightPadding);
    expect(metrics.main.width).toBeGreaterThanOrEqual(560);
    return;
  }

  const context = metrics.context!;
  expect(metrics.contextDisplay).not.toBe("none");
  expect(context).not.toBeNull();
  expectPx(context.top, metrics.main.top, 2);
  expectPx(context.left, metrics.main.right + FRAME.columnGap);
  expectPx(context.right, metrics.scrollContentRight - FRAME.pageRightPadding);
  expectPx(context.width, expectedContextWidth(metrics.scrollClientWidth, viewportWidth), 2);
}

function expectReaderGeometry(metrics: WorkbenchMetrics, viewportWidth: number) {
  const inlinePadding = readerInlinePadding(viewportWidth);
  const article = metrics.article!;
  const identity = metrics.identity!;
  const tabs = metrics.tabs!;
  expect(identity).not.toBeNull();
  expectPx(tabs.top, metrics.topbar.bottom);
  expectPx(metrics.main.left, metrics.scroll.left + inlinePadding);
  expectPx(metrics.main.top, metrics.scroll.top + FRAME.readerTopPadding, 2);
  expectPx(identity.top, metrics.main.top, 2);
  expectContainedAndCentered(identity, metrics.main);

  expect(article).not.toBeNull();
  expectPx(article.top, identity.bottom, 2);
  expectContainedAndCentered(article, metrics.main);
  expect(article.width).toBeGreaterThanOrEqual(560);
  expect(article.width).toBeLessThanOrEqual(FRAME.readerMaxWidth + 1);

  if (viewportWidth < 1200) {
    expect(metrics.contextDisplay).toBe("none");
    expectPx(metrics.context?.width ?? 0, 0);
    expectPx(metrics.main.right, metrics.scrollContentRight - inlinePadding);
    return;
  }

  const context = metrics.context!;
  expect(metrics.contextDisplay).not.toBe("none");
  expect(context).not.toBeNull();
  expectPx(context.top, metrics.main.top, 2);
  expectPx(context.left, metrics.main.right + readerColumnGap(viewportWidth), 2);
  expectPx(context.right, metrics.scrollContentRight - inlinePadding, 2);
  expectPx(context.width, readerContextWidth(viewportWidth), 2);
}

function expectContainedAndCentered(inner: RectMetrics, outer: RectMetrics) {
  expectContained(inner, outer);
  expectPx((inner.left + inner.right) / 2, (outer.left + outer.right) / 2, 2);
}

function expectContained(inner: RectMetrics, outer: RectMetrics) {
  expect(inner.top).toBeGreaterThanOrEqual(outer.top - 1);
  expect(inner.bottom).toBeLessThanOrEqual(outer.bottom + 1);
  expectHorizontallyContained(inner, outer);
}

function expectHorizontallyContained(inner: RectMetrics, outer: RectMetrics) {
  expect(inner.left).toBeGreaterThanOrEqual(outer.left - 1);
  expect(inner.right).toBeLessThanOrEqual(outer.right + 1);
}

function expectedContextWidth(scrollClientWidth: number, viewportWidth: number) {
  const trackSpace =
    scrollClientWidth - pageInlinePadding(viewportWidth) - FRAME.pageRightPadding - FRAME.columnGap;
  return Math.max(FRAME.minimumContextWidth, trackSpace / (FRAME.columnRatio + 1));
}

function pageInlinePadding(viewportWidth: number) {
  return Math.min(26, Math.max(18, viewportWidth * 0.0125));
}

function railWidth(viewportWidth: number) {
  return Math.min(296, Math.max(206, viewportWidth * 0.1445));
}

function paneHeaderHeight(viewportWidth: number) {
  return Math.min(50, Math.max(36, viewportWidth * 0.0244));
}

function workspaceRadius(viewportWidth: number) {
  return Math.min(16, Math.max(12, viewportWidth * 0.0078));
}

function homeComposerGap() {
  return 16;
}

function homeComposerBottomInset(viewportWidth: number) {
  return Math.min(16, Math.max(10, viewportWidth * 0.0078));
}

function readerInlinePadding(viewportWidth: number) {
  return Math.min(56, Math.max(30, viewportWidth * 0.04));
}

function readerColumnGap(viewportWidth: number) {
  return Math.min(58, Math.max(34, viewportWidth * 0.04));
}

function readerContextWidth(viewportWidth: number) {
  return Math.min(320, Math.max(264, viewportWidth * 0.2));
}

function expectPx(actual: number, expected: number, tolerance = 1) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

export async function measureReaderScroll(page: Page): Promise<ReaderScrollMetrics> {
  return page.evaluate(() => {
    const top = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing required reader element: ${selector}`);
      return element.getBoundingClientRect().top;
    };
    const scroll = document.querySelector<HTMLElement>("[data-page-scroll]");
    if (!scroll) throw new Error("Missing reader scroll container");
    const context = document.querySelector<HTMLElement>("[data-context-panel]");
    const contextRect = context?.getBoundingClientRect();

    return {
      windowScrollY: window.scrollY,
      bodyScrollTop: scroll.scrollTop,
      railTop: top("[data-shell-rail]"),
      topbarTop: top(".vx-topbar"),
      identityTop: top("[data-page-identity]"),
      tabsTop: top(".app-tabs"),
      scrollTop: scroll.getBoundingClientRect().top,
      contextTop: contextRect?.top ?? 0,
      contextLeft: contextRect?.left ?? 0,
      clientHeight: scroll.clientHeight,
      scrollHeight: scroll.scrollHeight,
    };
  });
}

export async function scrollReaderTo(page: Page, scrollTop: number) {
  await page.locator("[data-page-scroll]").evaluate((element, top) => {
    element.scrollTop = top;
  }, scrollTop);
}

export function expectReaderScrollBehavior(
  before: ReaderScrollMetrics,
  after: ReaderScrollMetrics,
  viewportWidth: number
) {
  expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
  expect(after.bodyScrollTop).toBeGreaterThan(0);
  expect(after.windowScrollY).toBe(0);
  expectPx(after.railTop, before.railTop);
  expectPx(after.topbarTop, before.topbarTop);
  expectPx(after.identityTop, before.identityTop - after.bodyScrollTop, 2);
  expect(after.identityTop).toBeLessThan(before.scrollTop);
  expectPx(after.tabsTop, before.tabsTop);
  expectPx(after.scrollTop, before.scrollTop);

  if (viewportWidth >= 1200) {
    expectPx(after.contextTop, before.scrollTop);
    expectPx(after.contextLeft, before.contextLeft);
  }
}
