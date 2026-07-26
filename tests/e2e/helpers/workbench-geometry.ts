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
  kind: "home" | "library" | "reader";
  viewport: { width: number; height: number };
  rootScrollWidth: number;
  chrome: RectMetrics;
  shell: RectMetrics;
  rail: RectMetrics;
  surface: RectMetrics;
  topbar: RectMetrics;
  identity: RectMetrics;
  tabs: RectMetrics | null;
  scroll: RectMetrics;
  article: RectMetrics | null;
  scrollClientWidth: number;
  scrollContentRight: number;
  context: RectMetrics | null;
  contextDisplay: string;
  main: RectMetrics;
  borderTopWidth: string;
  borderLeftWidth: string;
  borderRadius: number;
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
  chromeHeight: 56,
  railWidth: 216,
  topbarHeight: 44,
  identityHeight: 116,
  tabsHeight: 40,
  homeTopPadding: 24,
  libraryTopPadding: 29,
  pageLeftPadding: 28,
  homeRightPadding: 32,
  libraryRightPadding: 43,
  columnGap: 30,
  readerTopPadding: 44,
  readerMaxWidth: 880,
} as const;

export async function measureWorkbench(page: Page): Promise<WorkbenchMetrics> {
  return page.evaluate(() => {
    const required = <T extends Element>(selector: string): T => {
      const element = document.querySelector<T>(selector);
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

    const surface = required<HTMLElement>("[data-work-surface]");
    const scroll = required<HTMLElement>("[data-page-scroll]");
    const content = required<HTMLElement>("#main-content");
    const main = required<HTMLElement>(".home-feed, .lib-main, .reader-workbench > .main");
    const context = document.querySelector<HTMLElement>("[data-context-panel]");
    const article = document.querySelector<HTMLElement>("[data-article]");
    const tabs = document.querySelector<HTMLElement>("[data-page-tabs], .app-tabs");
    const kind = document.querySelector(".home-feed")
      ? "home"
      : document.querySelector(".lib-main")
        ? "library"
        : "reader";
    const surfaceStyle = getComputedStyle(surface);
    const scrollRect = scroll.getBoundingClientRect();

    return {
      kind,
      viewport: { width: innerWidth, height: innerHeight },
      rootScrollWidth: document.documentElement.scrollWidth,
      chrome: rectangle(required(".vx-desktop-chrome")),
      shell: rectangle(required("[data-shell-root]")),
      rail: rectangle(required("[data-shell-rail]")),
      surface: rectangle(surface),
      topbar: rectangle(required("[data-work-surface] .vx-topbar")),
      identity: rectangle(required("[data-page-identity]")),
      tabs: tabs ? rectangle(tabs) : null,
      scroll: rectangle(scroll),
      article: article ? rectangle(article) : null,
      scrollClientWidth: scroll.clientWidth,
      scrollContentRight: scrollRect.left + scroll.clientLeft + scroll.clientWidth,
      context: context ? rectangle(context) : null,
      contextDisplay: context ? getComputedStyle(context).display : "missing",
      main: rectangle(main),
      borderTopWidth: surfaceStyle.borderTopWidth,
      borderLeftWidth: surfaceStyle.borderLeftWidth,
      borderRadius: Number.parseFloat(surfaceStyle.borderTopLeftRadius),
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
  reader: boolean
) {
  expectFlatFrame(metrics, viewportWidth);
  if (reader) {
    expectReaderGeometry(metrics, viewportWidth);
  } else {
    expectCollectionGeometry(metrics, viewportWidth);
  }
}

function expectFlatFrame(metrics: WorkbenchMetrics, viewportWidth: number) {
  expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.viewport.width + 1);
  expect(metrics.mobileMenuDisplay).toBe("none");
  expect(metrics.borderTopWidth).toBe("0px");
  expect(metrics.borderLeftWidth).toBe("1px");
  expect(metrics.boxShadow).toBe("none");
  expect(metrics.overflow).toBe("hidden");
  expectPx(metrics.borderRadius, 0);

  expectPx(metrics.chrome.top, 0);
  expectPx(metrics.chrome.left, 0);
  expectPx(metrics.chrome.width, viewportWidth);
  expectPx(metrics.chrome.height, FRAME.chromeHeight);

  expectPx(metrics.shell.top, FRAME.chromeHeight);
  expectPx(metrics.shell.bottom, metrics.viewport.height);
  expectPx(metrics.rail.top, FRAME.chromeHeight);
  expectPx(metrics.rail.left, 0);
  expectPx(metrics.rail.width, FRAME.railWidth);
  expectPx(metrics.rail.bottom, metrics.viewport.height);

  expectPx(metrics.surface.left, FRAME.railWidth);
  expectPx(metrics.surface.top, FRAME.chromeHeight);
  expectPx(metrics.surface.right, metrics.viewport.width);
  expectPx(metrics.surface.bottom, metrics.viewport.height);

  expectPx(metrics.topbar.left, metrics.surface.left + 1);
  expectPx(metrics.topbar.right, metrics.surface.right);
  expectPx(metrics.topbar.top, metrics.surface.top);
  expectPx(metrics.topbar.height, FRAME.topbarHeight);

  expectPx(metrics.scroll.left, metrics.topbar.left);
  expectPx(metrics.scroll.right, metrics.topbar.right);
  expectPx(metrics.scroll.bottom, metrics.surface.bottom);
  expect(metrics.scrollClientWidth).toBeGreaterThan(0);
  expect(metrics.contentScrollWidth).toBeLessThanOrEqual(metrics.contentClientWidth + 1);
}

function expectCollectionGeometry(metrics: WorkbenchMetrics, viewportWidth: number) {
  expectPx(metrics.identity.left, metrics.topbar.left);
  expectPx(metrics.identity.right, metrics.topbar.right);
  expectPx(metrics.identity.top, metrics.topbar.bottom);
  expectPx(metrics.identity.height, FRAME.identityHeight);
  if (metrics.kind === "home") {
    expect(metrics.tabs).toBeNull();
    expectPx(metrics.scroll.top, metrics.identity.bottom);
  } else {
    const tabs = metrics.tabs!;
    expect(tabs).not.toBeNull();
    expectPx(tabs.left, metrics.topbar.left);
    expectPx(tabs.right, metrics.topbar.right);
    expectPx(tabs.top, metrics.identity.bottom);
    expectPx(tabs.height, FRAME.tabsHeight);
    expectPx(metrics.scroll.top, tabs.bottom);
  }
  expectPx(metrics.main.left, metrics.scroll.left + FRAME.pageLeftPadding);
  expectPx(
    metrics.main.top,
    metrics.scroll.top + (metrics.kind === "home" ? FRAME.homeTopPadding : FRAME.libraryTopPadding),
    2
  );

  const context = metrics.context!;
  const rightPadding = metrics.kind === "home" ? FRAME.homeRightPadding : FRAME.libraryRightPadding;
  expect(metrics.contextDisplay).not.toBe("none");
  expect(context).not.toBeNull();
  expectPx(context.top, metrics.main.top + (viewportWidth < 1200 ? 10 : 0), 2);
  expectPx(context.left, metrics.main.right + FRAME.columnGap);
  expectPx(context.right, metrics.scrollContentRight - rightPadding);
  expectPx(context.width, contextWidth(viewportWidth), 2);
  expect(metrics.main.width).toBeGreaterThanOrEqual(380);
}

function expectReaderGeometry(metrics: WorkbenchMetrics, viewportWidth: number) {
  const inlinePadding = readerInlinePadding(viewportWidth);
  const article = metrics.article!;
  const tabs = metrics.tabs!;
  expect(tabs).not.toBeNull();
  expectPx(tabs.left, metrics.topbar.left);
  expectPx(tabs.right, metrics.topbar.right);
  expectPx(tabs.top, metrics.topbar.bottom);
  expectPx(tabs.height, FRAME.tabsHeight);
  expectPx(metrics.scroll.top, tabs.bottom);
  expectPx(metrics.main.left, metrics.scroll.left + inlinePadding);
  expectPx(metrics.main.top, metrics.scroll.top + FRAME.readerTopPadding, 2);
  expectPx(metrics.identity.top, metrics.main.top, 2);
  expectContainedAndCentered(metrics.identity, metrics.main);

  expect(article).not.toBeNull();
  expectPx(article.top, metrics.identity.bottom, 2);
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
  expectPx(context.left, metrics.main.right + inlinePadding, 2);
  expectPx(context.right, metrics.scrollContentRight - inlinePadding, 2);
  expectPx(context.width, readerContextWidth(viewportWidth), 2);
}

function expectContainedAndCentered(inner: RectMetrics, outer: RectMetrics) {
  expect(inner.left).toBeGreaterThanOrEqual(outer.left - 1);
  expect(inner.right).toBeLessThanOrEqual(outer.right + 1);
  expectPx((inner.left + inner.right) / 2, (outer.left + outer.right) / 2, 2);
}

function readerInlinePadding(viewportWidth: number) {
  if (viewportWidth < 1200) {
    return Math.min(72, Math.max(32, viewportWidth * 0.07));
  }
  return Math.min(36, Math.max(28, viewportWidth * 0.025));
}

function readerContextWidth(viewportWidth: number) {
  return contextWidth(viewportWidth);
}

function contextWidth(viewportWidth: number) {
  return Math.min(292, Math.max(264, viewportWidth * 0.21));
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
