import { expect, test } from "playwright/test";

const desktopWidths = [1024, 1280, 1440];
const coreRoutes = ["/", "/library", "/read/demo"];

const FRAME = {
  chromeHeight: 56,
  railWidth: 260,
  surfaceRightInset: 10,
  surfaceBottomInset: 10,
  surfaceRadius: 17,
  topbarHeight: 44,
  identityHeight: 143,
  tabsHeight: 54,
  pageTopPadding: 29,
  pageLeftPadding: 30,
  pageRightPadding: 43,
  columnGap: 30,
  minimumContextWidth: 304,
  columnRatio: 2.18,
} as const;

function expectPx(actual: number, expected: number, tolerance = 1) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

function expectedContextWidth(scrollClientWidth: number) {
  const trackSpace =
    scrollClientWidth - FRAME.pageLeftPadding - FRAME.pageRightPadding - FRAME.columnGap;
  return Math.max(FRAME.minimumContextWidth, trackSpace / (FRAME.columnRatio + 1));
}

for (const width of desktopWidths) {
  test.describe(`${width}px workbench`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const route of coreRoutes) {
      test(`${route} follows the fixed desktop frame and page-band geometry`, async ({ page }) => {
        await page.goto(route);
        await expect(page.locator("#main-content")).toBeVisible();
        await expect(page.locator("[data-page-identity]")).toBeVisible();
        await expect(page.locator("[data-page-tabs], .app-tabs")).toBeVisible();
        await expect(page.locator("[data-page-scroll]")).toBeVisible();

        const metrics = await page.evaluate(() => {
          const box = (element: Element | null) => {
            if (!element) return null;
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
          const surface = document.querySelector<HTMLElement>("[data-work-surface]");
          const context = document.querySelector<HTMLElement>("[data-context-panel]");
          const main = document.querySelector<HTMLElement>(
            ".home-feed, .lib-main, .reader-workbench > .main"
          );
          const content = document.querySelector<HTMLElement>("#main-content");
          const scroll = document.querySelector<HTMLElement>("[data-page-scroll]")!;
          const surfaceStyle = surface ? getComputedStyle(surface) : null;

          return {
            viewport: { width: innerWidth, height: innerHeight },
            rootScrollWidth: document.documentElement.scrollWidth,
            chrome: box(document.querySelector(".vx-desktop-chrome")),
            shell: box(document.querySelector("[data-shell-root]")),
            rail: box(document.querySelector("[data-shell-rail]")),
            surface: box(surface),
            topbar: box(surface?.querySelector(".vx-topbar") ?? null),
            identity: box(document.querySelector("[data-page-identity]")),
            tabs: box(document.querySelector("[data-page-tabs], .app-tabs")),
            scroll: box(scroll),
            scrollClientWidth: scroll.clientWidth,
            scrollContentRight:
              scroll.getBoundingClientRect().left + scroll.clientLeft + scroll.clientWidth,
            context: box(context),
            contextDisplay: context ? getComputedStyle(context).display : "missing",
            main: box(main),
            borderTopWidth: surfaceStyle?.borderTopWidth ?? "",
            borderRadius: Number.parseFloat(surfaceStyle?.borderTopLeftRadius ?? "0"),
            overflow: surfaceStyle?.overflow ?? "",
            contentClientWidth: content?.clientWidth ?? 0,
            contentScrollWidth: content?.scrollWidth ?? 0,
            mobileMenuDisplay: (() => {
              const menu = document.querySelector<HTMLElement>(".vx-topbar-menu");
              return menu ? getComputedStyle(menu).display : "missing";
            })(),
          };
        });

        expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.viewport.width + 1);
        expect(metrics.chrome).not.toBeNull();
        expect(metrics.shell).not.toBeNull();
        expect(metrics.rail).not.toBeNull();
        expect(metrics.surface).not.toBeNull();
        expect(metrics.topbar).not.toBeNull();
        expect(metrics.identity).not.toBeNull();
        expect(metrics.tabs).not.toBeNull();
        expect(metrics.scroll).not.toBeNull();
        expect(metrics.main).not.toBeNull();
        expect(metrics.mobileMenuDisplay).toBe("none");
        expect(metrics.borderTopWidth).toBe("1px");
        expect(metrics.overflow).toBe("hidden");
        expectPx(metrics.borderRadius, FRAME.surfaceRadius);

        expectPx(metrics.chrome!.top, 0);
        expectPx(metrics.chrome!.left, 0);
        expectPx(metrics.chrome!.width, width);
        expectPx(metrics.chrome!.height, FRAME.chromeHeight);

        expectPx(metrics.shell!.top, FRAME.chromeHeight);
        expectPx(metrics.shell!.bottom, metrics.viewport.height);
        expectPx(metrics.rail!.top, FRAME.chromeHeight);
        expectPx(metrics.rail!.left, 0);
        expectPx(metrics.rail!.width, FRAME.railWidth);
        expectPx(metrics.rail!.bottom, metrics.viewport.height);

        expectPx(metrics.surface!.left, FRAME.railWidth);
        expectPx(metrics.surface!.top, FRAME.chromeHeight);
        expectPx(metrics.viewport.width - metrics.surface!.right, FRAME.surfaceRightInset);
        expectPx(metrics.viewport.height - metrics.surface!.bottom, FRAME.surfaceBottomInset);

        expectPx(metrics.topbar!.left, metrics.surface!.left + 1);
        expectPx(metrics.topbar!.right, metrics.surface!.right - 1);
        expectPx(metrics.topbar!.top, metrics.surface!.top + 1);
        expectPx(metrics.topbar!.height, FRAME.topbarHeight);

        expectPx(metrics.identity!.left, metrics.topbar!.left);
        expectPx(metrics.identity!.right, metrics.topbar!.right);
        expectPx(metrics.identity!.top, metrics.topbar!.bottom);
        expectPx(metrics.identity!.height, FRAME.identityHeight);

        expectPx(metrics.tabs!.left, metrics.identity!.left);
        expectPx(metrics.tabs!.right, metrics.identity!.right);
        expectPx(metrics.tabs!.top, metrics.identity!.bottom);
        expectPx(metrics.tabs!.height, FRAME.tabsHeight);

        expectPx(metrics.scroll!.left, metrics.tabs!.left);
        expectPx(metrics.scroll!.right, metrics.tabs!.right);
        expectPx(metrics.scroll!.top, metrics.tabs!.bottom);
        expectPx(metrics.scroll!.bottom, metrics.surface!.bottom - 1);
        expect(metrics.scrollClientWidth).toBeGreaterThan(0);
        expect(metrics.contentScrollWidth).toBeLessThanOrEqual(metrics.contentClientWidth + 1);

        expectPx(metrics.main!.left, metrics.scroll!.left + FRAME.pageLeftPadding);
        expectPx(metrics.main!.top, metrics.scroll!.top + FRAME.pageTopPadding, 2);

        if (width < 1200) {
          expect(metrics.contextDisplay).toBe("none");
          expectPx(metrics.context?.width ?? 0, 0);
          expectPx(metrics.main!.right, metrics.scrollContentRight - FRAME.pageRightPadding);
          expect(metrics.main!.width).toBeGreaterThanOrEqual(560);
        } else {
          expect(metrics.contextDisplay).not.toBe("none");
          expect(metrics.context).not.toBeNull();
          expectPx(metrics.context!.top, metrics.main!.top, 2);
          expectPx(metrics.context!.left, metrics.main!.right + FRAME.columnGap);
          expectPx(metrics.context!.right, metrics.scrollContentRight - FRAME.pageRightPadding);
          expectPx(metrics.context!.width, expectedContextWidth(metrics.scrollClientWidth), 2);
        }

        if (route === "/read/demo") {
          const readableWidth = await page
            .locator("[data-article]")
            .evaluate((article) => article.getBoundingClientRect().width);
          expect(readableWidth).toBeGreaterThanOrEqual(560);
        }
      });
    }
  });

  test.describe(`${width}px reader scrolling`, () => {
    test.use({ viewport: { width, height: 800 } });

    test("scrolls only the reader body while fixed bands stay in place", async ({ page }) => {
      await page.goto("/read/demo");
      const scroll = page.locator("[data-page-scroll]");
      await expect(page.locator("[data-page-identity]")).toBeVisible();
      await expect(page.locator(".app-tabs")).toBeVisible();
      await expect(scroll).toBeVisible();

      const before = await page.evaluate(() => {
        const top = (selector: string) =>
          document.querySelector<HTMLElement>(selector)!.getBoundingClientRect().top;
        const scroll = document.querySelector<HTMLElement>("[data-page-scroll]")!;
        const context = document.querySelector<HTMLElement>("[data-context-panel]");
        return {
          railTop: top("[data-shell-rail]"),
          topbarTop: top(".vx-topbar"),
          identityTop: top("[data-page-identity]"),
          tabsTop: top(".app-tabs"),
          scrollTop: scroll.getBoundingClientRect().top,
          contextLeft: context?.getBoundingClientRect().left ?? 0,
          clientHeight: scroll.clientHeight,
          scrollHeight: scroll.scrollHeight,
        };
      });

      expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
      await scroll.evaluate((element) => {
        element.scrollTop = 500;
      });

      const after = await page.evaluate(() => {
        const top = (selector: string) =>
          document.querySelector<HTMLElement>(selector)!.getBoundingClientRect().top;
        const scroll = document.querySelector<HTMLElement>("[data-page-scroll]")!;
        const context = document.querySelector<HTMLElement>("[data-context-panel]");
        return {
          windowScrollY: window.scrollY,
          bodyScrollTop: scroll.scrollTop,
          railTop: top("[data-shell-rail]"),
          topbarTop: top(".vx-topbar"),
          identityTop: top("[data-page-identity]"),
          tabsTop: top(".app-tabs"),
          scrollTop: scroll.getBoundingClientRect().top,
          contextTop: context?.getBoundingClientRect().top ?? 0,
          contextLeft: context?.getBoundingClientRect().left ?? 0,
        };
      });

      expect(after.bodyScrollTop).toBeGreaterThan(0);
      expect(after.windowScrollY).toBe(0);
      expectPx(after.railTop, before.railTop);
      expectPx(after.topbarTop, before.topbarTop);
      expectPx(after.identityTop, before.identityTop);
      expectPx(after.tabsTop, before.tabsTop);
      expectPx(after.scrollTop, before.scrollTop);
      if (width >= 1200) {
        expectPx(after.contextTop, before.scrollTop);
        expectPx(after.contextLeft, before.contextLeft);
      }
    });
  });
}

test.describe("Desktop workspace navigation", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("groups workspace destinations and keeps search in the rail", async ({ page }) => {
    await page.goto("/library");

    await expect(page.getByRole("navigation", { name: "Quick access navigation" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Pinned" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Workspace" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Configure" })).toBeAttached();

    const search = page.getByRole("link", { name: "Search" });
    await expect(search).toHaveAttribute("href", "/search");
    await expect(
      page.locator("[data-shell-rail]").getByRole("link", { name: "New document", exact: true })
    ).toHaveAttribute("href", "/editor");
    await expect(page.getByRole("button", { name: "Switch workspace" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
    await expect(page.getByRole("navigation", { name: "Current location" })).toHaveText(
      "Local workspace/Library"
    );
  });

  test("supports a keyboard path through desktop chrome, skip link, and primary destinations", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Go back" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Go forward" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page
        .getByRole("navigation", { name: "Workspace tabs" })
        .getByRole("link", { name: "Home", exact: true })
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page
        .getByRole("navigation", { name: "Workspace tabs" })
        .getByRole("link", { name: "Library", exact: true })
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("navigation", { name: "Workspace tabs" }).getByRole("link", {
        name: "New document",
      })
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    await page.goto("/");
    for (let index = 0; index < 6; index += 1) await page.keyboard.press("Tab");
    const rail = page.locator("[data-shell-rail]");
    await page.keyboard.press("Tab");
    await expect(rail.getByRole("button", { name: "Switch workspace" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(rail.getByRole("link", { name: "Search" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(rail.getByRole("link", { name: "New document", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(rail.getByRole("link", { name: "Inbox", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(rail.getByRole("link", { name: "Agent", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    const library = rail.getByRole("link", { name: "Library", exact: true });
    await expect(library).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/library$/);
    await expect(library).toHaveAttribute("aria-current", "page");
  });
});

test.describe("Desktop tabs and route persistence", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("gives Library views one selected tab and complete arrow-key navigation", async ({
    page,
  }) => {
    await page.goto("/library");
    const tablist = page.getByRole("tablist", { name: "Library views" });
    const all = tablist.getByRole("tab", { name: /All Documents/ });
    const notes = tablist.getByRole("tab", { name: /Notes/ });
    const archives = tablist.getByRole("tab", { name: /Archives/ });

    await expect(all).toHaveAttribute("aria-selected", "true");
    await expect(all).toHaveAttribute("tabindex", "0");
    await expect(tablist.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
    await expect(page.getByRole("tabpanel")).toHaveAttribute("id", "library-documents");

    await all.focus();
    await page.keyboard.press("ArrowRight");
    await expect(notes).toBeFocused();
    await expect(notes).toHaveAttribute("aria-selected", "true");
    await expect(all).toHaveAttribute("tabindex", "-1");

    await page.keyboard.press("End");
    await expect(archives).toBeFocused();
    await expect(archives).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("Home");
    await expect(all).toBeFocused();
    await expect(all).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("list", { name: "Documents" })).toBeVisible();
  });

  test("keeps document tabs functional and returns home when the final tab closes", async ({
    page,
  }) => {
    await page.goto("/read/demo");
    const tab = page.getByRole("tab", { name: "Demo" });
    await expect(tab).toBeVisible();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await tab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(tab).toBeFocused();

    await page.getByRole("button", { name: "Close Demo" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("tablist", { name: "Open documents" })).toHaveCount(0);
  });

  test("preserves the shell through the Home, Library, Reader, and Library journey", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const host = window as Window & {
        __vertoShell?: { rail: Element | null; surface: Element | null };
      };
      host.__vertoShell = {
        rail: document.querySelector("[data-shell-rail]"),
        surface: document.querySelector("[data-work-surface]"),
      };
    });

    await page.locator("[data-shell-rail]").getByRole("link", { name: "Library" }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByRole("heading", { name: "Library", level: 1 })).toBeVisible();
    await expect(page.locator('[data-shell-rail] a[aria-current="page"]')).toHaveCount(1);

    const documents = page.getByRole("list", { name: "Documents" });
    await documents.locator('a[href="/read/demo"]').click();
    await expect(page).toHaveURL(/\/read\/demo$/);
    await expect(page.getByRole("heading", { name: "Verto Feature Demo", level: 1 })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Demo" })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[data-shell-rail] a[aria-current="page"]')).toHaveCount(1);

    await page.locator("[data-shell-rail]").getByRole("link", { name: "Library" }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByRole("navigation", { name: "Current location" })).toHaveText(
      "Local workspace/Library"
    );
    await expect
      .poll(() =>
        page.evaluate(() => {
          const host = window as Window & {
            __vertoShell?: { rail: Element | null; surface: Element | null };
          };
          return (
            host.__vertoShell?.rail === document.querySelector("[data-shell-rail]") &&
            host.__vertoShell?.surface === document.querySelector("[data-work-surface]")
          );
        })
      )
      .toBe(true);
  });
});

test.describe("Desktop runtime health", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("does not emit uncaught or console errors across the core routes", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });

    for (const route of coreRoutes) {
      await page.goto(route);
      await expect(page.locator("#main-content")).toBeVisible();
    }

    expect(errors).toEqual([]);
  });
});
