import { expect, test } from "playwright/test";

const tabletWidths = [761, 768, 900, 1023];

for (const width of tabletWidths) {
  test.describe(`${width}px tablet`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const route of ["/", "/read/demo"]) {
      test(`${route} uses the drawer frame without horizontal overflow`, async ({ page }) => {
        await page.goto(route);
        await expect(page.locator("#main-content")).toBeVisible();
        const openNavigation = page.getByRole("button", { name: "Open navigation" });
        await expect(openNavigation).toBeVisible();
        await expect(page.locator("[data-shell-rail]")).toBeHidden();

        const metrics = await page.evaluate(() => ({
          rootClientWidth: document.documentElement.clientWidth,
          rootScrollWidth: document.documentElement.scrollWidth,
          shellWidth: document.querySelector<HTMLElement>("[data-shell-root]")?.clientWidth ?? 0,
          contentWidth:
            document.querySelector<HTMLElement>(".vx-content, .app-content")?.clientWidth ?? 0,
        }));

        expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
        expect(metrics.shellWidth).toBe(metrics.rootClientWidth);
        expect(metrics.contentWidth).toBeGreaterThan(0);

        if (route === "/") {
          await openNavigation.click();
          const drawer = page.getByRole("dialog", { name: "Primary navigation" });
          await expect(drawer).toBeVisible();
          await drawer.getByRole("button", { name: "Close navigation" }).click();
          await expect(drawer).not.toBeVisible();

          await openNavigation.click();
          await expect(drawer).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(drawer).not.toBeVisible();
        }
      });
    }
  });
}

test.describe("1023px contextual rails", () => {
  test.use({ viewport: { width: 1023, height: 800 } });

  test("keeps Home, Library, and Agent context available", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("complementary", { name: "Workspace context" })).toBeVisible();

    await page.goto("/library");
    await expect(page.getByRole("complementary", { name: "Library context" })).toBeVisible();

    await page.goto("/agent");
    await expect(page.getByRole("complementary", { name: "Context" })).toBeVisible();

    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  });
});

test.describe("390px mobile frame", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of ["/", "/read/demo"]) {
    test(`${route} stays within the viewport and keeps drawer navigation`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("#main-content")).toBeVisible();
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
      await expect(page.locator("[data-shell-rail]")).toBeHidden();

      const widths = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
    });
  }

  test("keeps the dark navigation sheet readable outside the shell portal", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation" }).click();

    const drawer = page.getByRole("dialog", { name: "Primary navigation" });
    const currentRoute = drawer.getByRole("link", { name: "Home", exact: true });
    await expect(drawer).toBeVisible();
    await expect(currentRoute).toHaveAttribute("aria-current", "page");

    const colors = await page.evaluate(() => {
      const navigation = document.querySelector<HTMLElement>('[role="dialog"]')!;
      const active = navigation.querySelector<HTMLElement>('[aria-current="page"]')!;
      return {
        navigationBackground: getComputedStyle(navigation).backgroundColor,
        activeBackground: getComputedStyle(active).backgroundColor,
        activeColor: getComputedStyle(active).color,
      };
    });

    expect(colors.navigationBackground).toBe("rgb(25, 25, 23)");
    expect(colors.activeBackground).toBe("rgb(48, 48, 45)");
    expect(colors.activeColor).toBe("rgb(237, 237, 235)");
  });
});

test.describe("375px mobile Home", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("keeps the identity and metadata inside the viewport without duplicate page tabs", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();

    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const header = document.querySelector<HTMLElement>(".home-shell .pgh.is-entity");
      const headerLeft = header?.querySelector<HTMLElement>(".pgh-left");
      const headerRight = header?.querySelector<HTMLElement>(".pgh-right");
      const meta = header?.querySelector<HTMLElement>(".pgh-meta");
      const rect = (element: HTMLElement | null | undefined) => {
        if (!element) return null;
        const value = element.getBoundingClientRect();
        return {
          left: Math.round(value.left),
          right: Math.round(value.right),
          top: Math.round(value.top),
          bottom: Math.round(value.bottom),
          width: Math.round(value.width),
          height: Math.round(value.height),
        };
      };

      return {
        rootClientWidth: root.clientWidth,
        rootScrollWidth: root.scrollWidth,
        header: rect(header),
        headerLeft: rect(headerLeft),
        headerRight: rect(headerRight),
        metaDisplay: meta ? getComputedStyle(meta).display : null,
        metaHeight: rect(meta)?.height ?? 0,
        metaTops: meta
          ? [
              ...new Set(
                Array.from(meta.children, (item) => Math.round(item.getBoundingClientRect().top))
              ),
            ]
          : [],
        duplicatePageTabs: document.querySelector(".home-shell .surface-tabs") !== null,
      };
    });

    expect(layout.rootScrollWidth).toBeLessThanOrEqual(layout.rootClientWidth + 1);
    expect(layout.header).not.toBeNull();
    expect(layout.header!.left).toBeGreaterThanOrEqual(0);
    expect(layout.header!.right).toBeLessThanOrEqual(layout.rootClientWidth + 1);
    expect(layout.headerRight!.top).toBeGreaterThanOrEqual(layout.headerLeft!.bottom);
    expect(layout.metaDisplay).toBe("flex");
    expect(layout.metaHeight).toBeLessThanOrEqual(42);
    expect(layout.metaTops.length).toBeLessThanOrEqual(2);
    expect(layout.duplicatePageTabs).toBe(false);
  });
});

test.describe("375px mobile Reader", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("keeps the title and prose inside the viewport and navigation available", async ({
    page,
  }) => {
    await page.goto("/read/demo");
    await expect(page.locator("#main-content")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const content = document.querySelector<HTMLElement>(".app-content");
      const title = document.querySelector<HTMLElement>(".doc-title");
      const article = document.querySelector<HTMLElement>("[data-article]");
      const paragraph = article?.querySelector<HTMLElement>("p") ?? null;
      const sectionHeading = article?.querySelector<HTMLElement>("h2") ?? null;
      const rect = (element: HTMLElement | null) => {
        if (!element) return null;
        const value = element.getBoundingClientRect();
        return {
          left: Math.round(value.left),
          right: Math.round(value.right),
          width: Math.round(value.width),
        };
      };
      return {
        rootClientWidth: root.clientWidth,
        rootScrollWidth: root.scrollWidth,
        contentClientWidth: content?.clientWidth ?? 0,
        title: rect(title),
        article: rect(article),
        paragraph: rect(paragraph),
        sectionHeading: rect(sectionHeading),
        articleClientWidth: article?.clientWidth ?? 0,
        articleScrollWidth: article?.scrollWidth ?? 0,
      };
    });

    expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
    expect(metrics.contentClientWidth).toBeGreaterThanOrEqual(345);
    expect(metrics.title).not.toBeNull();
    expect(metrics.title!.left).toBeGreaterThanOrEqual(0);
    expect(metrics.title!.right).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
    expect(metrics.article).not.toBeNull();
    expect(metrics.article!.left).toBeGreaterThanOrEqual(0);
    expect(metrics.article!.right).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
    expect(metrics.articleScrollWidth).toBeLessThanOrEqual(metrics.articleClientWidth + 1);
    expect(metrics.paragraph).not.toBeNull();
    expect(metrics.sectionHeading).not.toBeNull();
    expect(Math.abs(metrics.sectionHeading!.left - metrics.paragraph!.left)).toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: "Open navigation" }).click();
    const navigation = page.getByRole("dialog", { name: "Primary navigation" });
    await expect(navigation).toBeVisible();

    await navigation.getByRole("link", { name: "Library" }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(navigation).not.toBeVisible();
  });

  test("keeps reader actions on one compact row", async ({ page }) => {
    await page.goto("/read/demo");
    const actions = page.locator(".doc-top .doc-copybtn:visible");
    await expect(actions).toHaveCount(4);

    const layout = await page.locator(".doc-top").evaluate((toolbar) => {
      const toolbarRect = toolbar.getBoundingClientRect();
      const children = Array.from(toolbar.children)
        .filter((child) => getComputedStyle(child).display !== "none")
        .map((child) => {
          const rect = child.getBoundingClientRect();
          return {
            top: Math.round(rect.top),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            height: Math.round(rect.height),
          };
        });
      return {
        height: Math.round(toolbar.getBoundingClientRect().height),
        scrollWidth: toolbar.scrollWidth,
        clientWidth: toolbar.clientWidth,
        left: Math.round(toolbarRect.left),
        right: Math.round(toolbarRect.right),
        children,
        tops: children.map((child) => child.top),
      };
    });

    expect(layout.height).toBeGreaterThanOrEqual(40);
    expect(layout.height).toBeLessThanOrEqual(44);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    expect([...new Set(layout.tops)]).toHaveLength(1);
    for (const child of layout.children) {
      expect(child.height).toBeGreaterThanOrEqual(40);
      expect(child.height).toBeLessThanOrEqual(44);
    }
    expect(Math.min(...layout.children.map((child) => child.left))).toBeGreaterThanOrEqual(
      layout.left
    );
    expect(Math.max(...layout.children.map((child) => child.right))).toBeLessThanOrEqual(
      layout.right
    );
  });
});

test.describe("375px mobile navigation pages", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("keeps Sources readable as a single column with actions below the heading", async ({
    page,
  }) => {
    await page.goto("/integrations");
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("#local-files")).toBeVisible();
    await expect(page.locator("#rss-feeds")).toBeVisible();

    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const headerLeft = document.querySelector<HTMLElement>(".pgh-left");
      const headerRight = document.querySelector<HTMLElement>(".pgh-right");
      const local = document.querySelector<HTMLElement>("#local-files");
      const rss = document.querySelector<HTMLElement>("#rss-feeds");
      const rect = (element: HTMLElement | null) => element?.getBoundingClientRect();

      return {
        rootClientWidth: root.clientWidth,
        rootScrollWidth: root.scrollWidth,
        headerLeft: rect(headerLeft),
        headerRight: rect(headerRight),
        local: rect(local),
        rss: rect(rss),
      };
    });

    expect(layout.rootScrollWidth).toBeLessThanOrEqual(layout.rootClientWidth + 1);
    expect(layout.headerLeft).not.toBeNull();
    expect(layout.headerRight).not.toBeNull();
    expect(layout.local).not.toBeNull();
    expect(layout.rss).not.toBeNull();
    expect(layout.headerRight!.top).toBeGreaterThanOrEqual(layout.headerLeft!.bottom);
    expect(layout.local!.width).toBeGreaterThanOrEqual(340);
    expect(layout.rss!.width).toBeGreaterThanOrEqual(340);
    expect(layout.rss!.top).toBeGreaterThan(layout.local!.top);
  });

  test("keeps the library source context clear and within the viewport", async ({ page }) => {
    await page.goto("/library");

    const source = page.getByRole("region", { name: "Library source" });
    await expect(source).toBeVisible();
    await expect(source.getByRole("link", { name: "Connect a folder" })).toBeVisible();
    await expect(
      page.locator("header[data-page-identity]").getByRole("link", { name: "Sources" })
    ).toBeVisible();

    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  });
});
