/* eslint-disable max-lines -- one matrix keeps cross-viewport geometry contracts together. */
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
        }
      });
    }
  });
}

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

  test("keeps drawer navigation and footer destinations reachable", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation" }).click();

    const drawer = page.getByRole("dialog", { name: "Primary navigation" });
    const scrollRegion = drawer.locator(".vx-rail-nav-scroll");
    const lastNavigationLink = scrollRegion.getByRole("link").last();
    const settings = drawer.getByRole("link", { name: "Settings" });
    await expect(drawer).toBeVisible();

    const overflow = await scrollRegion.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(overflow.scrollHeight).toBeGreaterThanOrEqual(overflow.clientHeight);
    expect(overflow.overflowY).toBe("auto");

    await lastNavigationLink.scrollIntoViewIfNeeded();
    await expect(lastNavigationLink).toBeVisible();
    await expect(settings).toBeVisible();
    await settings.click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(drawer).not.toBeVisible();
  });
});

test.describe("390px mobile Home composer", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps the composer and submit action within the viewport", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".codex-home-composer")).toBeVisible();

    const layout = await page.evaluate(() => {
      const rectangle = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing Home composer element: ${selector}`);
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

      return {
        viewportWidth: document.documentElement.clientWidth,
        rootScrollWidth: document.documentElement.scrollWidth,
        composer: rectangle(".codex-home-composer"),
        search: rectangle(".codex-home-search"),
        input: rectangle(".codex-home-search-input"),
        submit: rectangle(".codex-home-submit"),
      };
    });

    expect(layout.rootScrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.composer.left).toBeGreaterThanOrEqual(16);
    expect(layout.composer.right).toBeLessThanOrEqual(layout.viewportWidth - 16);
    expect(layout.input.width).toBeGreaterThan(0);
    expect(layout.submit.width).toBeCloseTo(36, 0);
    expect(layout.submit.height).toBeCloseTo(36, 0);
    expect(layout.submit.left).toBeGreaterThanOrEqual(layout.search.left);
    expect(layout.submit.right).toBeLessThanOrEqual(layout.search.right);
    expect(layout.submit.top).toBeGreaterThanOrEqual(layout.search.top);
    expect(layout.submit.bottom).toBeLessThanOrEqual(layout.search.bottom);
  });
});

test.describe("375px mobile Home", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("keeps the task transcript and composer in an unclipped vertical frame", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Search or ask your workspace" })
    ).toBeAttached();
    await expect(page.locator("[data-page-identity]")).toHaveCount(0);
    await expect(page.locator("[data-page-tabs], .app-tabs")).toHaveCount(0);

    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const rect = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing Home element: ${selector}`);
        const value = element.getBoundingClientRect();
        return {
          left: value.left,
          right: value.right,
          top: value.top,
          bottom: value.bottom,
          width: value.width,
          height: value.height,
        };
      };

      return {
        rootClientWidth: root.clientWidth,
        rootScrollWidth: root.scrollWidth,
        scroll: rect(".codex-thread-scroll"),
        transcript: rect(".codex-thread-transcript"),
        composer: rect(".codex-home-composer"),
        search: rect(".codex-home-search"),
      };
    });

    expect(layout.rootScrollWidth).toBeLessThanOrEqual(layout.rootClientWidth + 1);
    expect(layout.composer.left).toBeGreaterThanOrEqual(16);
    expect(layout.composer.right).toBeLessThanOrEqual(layout.rootClientWidth - 16);
    expect(
      Math.abs((layout.composer.left + layout.composer.right) / 2 - 375 / 2)
    ).toBeLessThanOrEqual(1);
    expect(layout.transcript.left).toBeGreaterThanOrEqual(0);
    expect(layout.transcript.right).toBeLessThanOrEqual(layout.rootClientWidth);
    expect(layout.scroll.bottom).toBeLessThanOrEqual(layout.composer.top);
    expect(layout.search.left).toBeGreaterThanOrEqual(layout.composer.left);
    expect(layout.search.right).toBeLessThanOrEqual(layout.composer.right);
    expect(layout.composer.bottom).toBeLessThanOrEqual(812);
  });

  test("uses flat divided workspace sections instead of separate rounded cards", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator(".codex-thread-library-summary > summary").click();
    await expect(page.locator(".home-feed")).toBeVisible();

    const layout = await page.evaluate(() => {
      const feed = document.querySelector<HTMLElement>(".home-feed");
      if (!feed) throw new Error("Missing Home workspace section");

      const itemStyles = (selector: string) =>
        Array.from(document.querySelectorAll<HTMLElement>(selector)).map((element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            borderRadius: style.borderRadius,
            borderLeftWidth: style.borderLeftWidth,
            borderRightWidth: style.borderRightWidth,
            boxShadow: style.boxShadow,
          };
        });

      const feedStyle = getComputedStyle(feed);
      return {
        feedDisplay: feedStyle.display,
        feedGap: feedStyle.rowGap,
        feedRadius: feedStyle.borderRadius,
        feedItems: itemStyles(".home-feed > .home-card, .home-feed > .home-collections"),
      };
    });

    expect(layout.feedDisplay).toBe("flex");
    expect(layout.feedGap).toBe("0px");
    expect(layout.feedRadius).toBe("0px");
    expect(layout.feedItems.length).toBeGreaterThan(0);
    for (const item of layout.feedItems) {
      expect(item.borderRadius).toBe("0px");
      expect(item.borderLeftWidth).toBe("0px");
      expect(item.borderRightWidth).toBe("0px");
      expect(item.boxShadow).toBe("none");
    }
    for (let index = 1; index < layout.feedItems.length; index += 1) {
      expect(
        Math.abs(layout.feedItems[index].top - layout.feedItems[index - 1].bottom)
      ).toBeLessThanOrEqual(1);
    }
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

    await navigation.getByRole("link", { name: "Library", exact: true }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(navigation).not.toBeVisible();
  });

  test("keeps reader actions on one compact row", async ({ page }) => {
    await page.goto("/read/demo");
    const actions = page.locator(".doc-top .doc-copybtn:visible");
    await expect(actions).toHaveCount(3);

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

test.describe("390px mobile Reader masthead", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps the content-first masthead left aligned", async ({ page }) => {
    await page.goto("/read/demo");
    await expect(page.locator("#main-content")).toBeVisible();

    const alignment = await page.locator(".doc-header").evaluate((header) => {
      const required = (selector: string) => {
        const element = header.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing masthead element: ${selector}`);
        return element;
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
        headerTextAlign: getComputedStyle(headerElement).textAlign,
        titleTextAlign: getComputedStyle(title).textAlign,
        dekTextAlign: getComputedStyle(dek).textAlign,
        rowJustification: alignedRows.map((selector) => ({
          selector,
          justifyContent: getComputedStyle(required(selector)).justifyContent,
        })),
      };
    });

    expect(alignment.headerTextAlign).toBe("left");
    expect(alignment.titleTextAlign).toBe("left");
    expect(alignment.dekTextAlign).toBe("left");
    for (const row of alignment.rowJustification) {
      expect(row.justifyContent, row.selector).toBe("flex-start");
    }
  });
});

test.describe("320px compact mobile Reader", () => {
  test.use({ viewport: { width: 320, height: 720 } });

  test("wraps Copy after the primary actions without clipping long states", async ({ page }) => {
    await page.addInitScript(() => {
      const href = "/read/demo";
      window.localStorage.setItem(
        "verto:bookmarks",
        JSON.stringify([
          {
            href,
            title: "Verto Feature Demo",
            kind: "document",
            addedAt: "2026-07-15T00:00:00.000Z",
          },
        ])
      );
      window.localStorage.setItem(
        "verto:collections",
        JSON.stringify(
          Array.from({ length: 12 }, (_, index) => ({
            id: `reader-${index}`,
            name: `Reader ${index}`,
            docHrefs: [href],
            createdAt: "2026-07-15T00:00:00.000Z",
          }))
        )
      );
    });

    await page.goto("/read/demo");
    await expect(page.getByRole("button", { name: "Remove bookmark" })).toBeVisible();
    await expect(page.getByRole("button", { name: "In 12 collections" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reading settings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy page" })).toBeVisible();
    await expect(page.locator(".doc-copybtn-label--wide")).toBeHidden();
    await expect(page.locator(".doc-copybtn-label--compact")).toHaveText("Copy");

    const layout = await page.locator(".doc-top").evaluate((toolbar) => {
      const visibleChildren = Array.from(toolbar.children).filter(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && getComputedStyle(child).display !== "none"
      );
      const rect = (element: HTMLElement) => {
        const value = element.getBoundingClientRect();
        return {
          top: Math.round(value.top),
          right: Math.round(value.right),
          bottom: Math.round(value.bottom),
          left: Math.round(value.left),
        };
      };
      const copy = toolbar.querySelector<HTMLElement>(".doc-copybtn--copy");
      const primary = visibleChildren.filter((child) => child !== copy);

      return {
        rootClientWidth: document.documentElement.clientWidth,
        rootScrollWidth: document.documentElement.scrollWidth,
        overflowX: getComputedStyle(toolbar).overflowX,
        clientWidth: toolbar.clientWidth,
        scrollWidth: toolbar.scrollWidth,
        toolbar: rect(toolbar as HTMLElement),
        children: visibleChildren.map((child) => ({
          ...rect(child),
          clientWidth: child.clientWidth,
          scrollWidth: child.scrollWidth,
        })),
        rowTops: [
          ...new Set(visibleChildren.map((child) => Math.round(child.getBoundingClientRect().top))),
        ],
        copyTop: copy ? Math.round(copy.getBoundingClientRect().top) : null,
        primaryBottom: Math.max(
          ...primary.map((child) => Math.round(child.getBoundingClientRect().bottom))
        ),
      };
    });

    expect(layout.rootScrollWidth).toBeLessThanOrEqual(layout.rootClientWidth + 1);
    expect(layout.overflowX).not.toBe("auto");
    expect(layout.overflowX).not.toBe("scroll");
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.rowTops).toHaveLength(2);
    expect(layout.copyTop).not.toBeNull();
    expect(layout.copyTop!).toBeGreaterThanOrEqual(layout.primaryBottom);
    for (const child of layout.children) {
      expect(child.left).toBeGreaterThanOrEqual(layout.toolbar.left);
      expect(child.right).toBeLessThanOrEqual(layout.toolbar.right + 1);
      expect(child.scrollWidth).toBeLessThanOrEqual(child.clientWidth + 1);
    }
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

    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  });
});

test.describe("390px mobile product workbenches", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps Library identity actions and tabs in an unclipped vertical flow", async ({
    page,
  }) => {
    await page.goto("/library");
    await expect(page.getByRole("link", { name: "Sources" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New", exact: true })).toBeVisible();
    await expect(page.locator(".lib-tabs")).toBeVisible();

    const layout = await page.evaluate(() => {
      const required = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing Library element: ${selector}`);
        return element;
      };
      const rect = (element: HTMLElement) => {
        const value = element.getBoundingClientRect();
        return {
          top: Math.round(value.top),
          right: Math.round(value.right),
          bottom: Math.round(value.bottom),
          left: Math.round(value.left),
          height: Math.round(value.height),
        };
      };

      const header = required(".pgh.is-entity");
      const headerLeft = required(".pgh.is-entity .pgh-left");
      const actions = required(".pgh.is-entity .pgh-action-group");
      const tabs = required(".lib-tabs");
      const style = getComputedStyle(header);

      return {
        rootClientWidth: document.documentElement.clientWidth,
        rootScrollWidth: document.documentElement.scrollWidth,
        header: rect(header),
        headerLeft: rect(headerLeft),
        actions: rect(actions),
        tabs: rect(tabs),
        headerHeight: style.height,
        headerMinHeight: style.minHeight,
        headerOverflow: style.overflow,
      };
    });

    expect(layout.rootScrollWidth).toBeLessThanOrEqual(layout.rootClientWidth + 1);
    expect(layout.headerHeight).not.toBe("104px");
    expect(layout.headerMinHeight).toBe("0px");
    expect(layout.headerOverflow).toBe("visible");
    expect(layout.actions.top).toBeGreaterThanOrEqual(layout.headerLeft.bottom);
    expect(layout.header.bottom).toBeGreaterThanOrEqual(layout.actions.bottom);
    expect(layout.tabs.top).toBeGreaterThanOrEqual(layout.header.bottom - 1);
    expect(layout.actions.left).toBeGreaterThanOrEqual(layout.header.left);
    expect(layout.actions.right).toBeLessThanOrEqual(layout.header.right);
  });

  test("centers the active deep-linked Settings section inside its horizontal nav", async ({
    page,
  }) => {
    await page.goto("/settings/agent");
    await expect(page.locator(".pgh-right")).toHaveCount(0);
    const nav = page.getByRole("navigation", { name: "Settings sections" });
    const active = nav.getByRole("link", { name: "AI & Agent" });
    await expect(nav).toBeVisible();
    await expect(active).toHaveAttribute("aria-current", "page");

    await expect
      .poll(async () =>
        active.evaluate((element) => {
          const item = element.getBoundingClientRect();
          const container = element.parentElement?.getBoundingClientRect();
          return container
            ? item.left >= container.left - 1 && item.right <= container.right + 1
            : false;
        })
      )
      .toBe(true);

    const layout = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>(".set-nav");
      const panels = document.querySelector<HTMLElement>(".set-panels");
      const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
      if (!nav || !panels || !active) throw new Error("Missing Settings layout");
      const navRect = nav.getBoundingClientRect();
      const panelRect = panels.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();

      return {
        rootClientWidth: document.documentElement.clientWidth,
        rootScrollWidth: document.documentElement.scrollWidth,
        navClientWidth: nav.clientWidth,
        navScrollWidth: nav.scrollWidth,
        navScrollLeft: nav.scrollLeft,
        navBottom: Math.round(navRect.bottom),
        panelTop: Math.round(panelRect.top),
        activeLeft: Math.round(activeRect.left),
        activeRight: Math.round(activeRect.right),
        navLeft: Math.round(navRect.left),
        navRight: Math.round(navRect.right),
      };
    });

    expect(layout.rootScrollWidth).toBeLessThanOrEqual(layout.rootClientWidth + 1);
    expect(layout.navScrollWidth).toBeGreaterThan(layout.navClientWidth);
    expect(layout.navScrollLeft).toBeGreaterThan(0);
    expect(layout.activeLeft).toBeGreaterThanOrEqual(layout.navLeft - 1);
    expect(layout.activeRight).toBeLessThanOrEqual(layout.navRight + 1);
    expect(layout.panelTop).toBeGreaterThanOrEqual(layout.navBottom);
  });

  test("stacks Source titles and keeps status pills on one line", async ({ page }) => {
    await page.goto("/integrations");
    await expect(page.locator("#local-files .src-status")).toBeVisible();
    await expect(page.locator("#rss-feeds .src-status")).toBeVisible();

    const cards = await page.locator(".src-source-card").evaluateAll((elements) =>
      elements.map((element) => {
        const titleRow = element.querySelector<HTMLElement>(".src-source-title-row");
        const status = element.querySelector<HTMLElement>(".src-status");
        const meta = element.querySelector<HTMLElement>(".src-source-meta, .src-detail-grid");
        if (!titleRow || !status || !meta) throw new Error("Missing Source card anatomy");
        const statusRect = status.getBoundingClientRect();
        const cardStyle = getComputedStyle(element);
        const metaStyle = getComputedStyle(meta);
        return {
          direction: getComputedStyle(titleRow).flexDirection,
          whiteSpace: getComputedStyle(status).whiteSpace,
          statusHeight: Math.round(statusRect.height),
          statusScrollHeight: status.scrollHeight,
          statusClientWidth: status.clientWidth,
          statusScrollWidth: status.scrollWidth,
          gridColumns: getComputedStyle(meta).gridTemplateColumns,
          cardRadius: cardStyle.borderRadius,
          cardBorderLeft: cardStyle.borderLeftWidth,
          cardBorderRight: cardStyle.borderRightWidth,
          metaRadius: metaStyle.borderRadius,
        };
      })
    );

    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
    for (const card of cards) {
      expect(card.direction).toBe("column");
      expect(card.whiteSpace).toBe("nowrap");
      expect(card.statusScrollHeight).toBeLessThanOrEqual(card.statusHeight + 1);
      expect(card.statusScrollWidth).toBeLessThanOrEqual(card.statusClientWidth + 1);
      expect(card.gridColumns.trim().split(/\s+/)).toHaveLength(1);
      expect(card.cardRadius).toBe("0px");
      expect(card.cardBorderLeft).toBe("0px");
      expect(card.cardBorderRight).toBe("0px");
      expect(card.metaRadius).toBe("0px");
    }
  });
});

test.describe("900px compact Settings", () => {
  test.use({ viewport: { width: 900, height: 900 } });

  test("keeps deep-linked navigation above the active panel without overflow", async ({ page }) => {
    await page.goto("/settings/agent");
    const nav = page.getByRole("navigation", { name: "Settings sections" });
    const active = nav.getByRole("link", { name: "AI & Agent" });
    await expect(active).toHaveAttribute("aria-current", "page");

    const layout = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>(".set-nav");
      const panels = document.querySelector<HTMLElement>(".set-panels");
      const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
      if (!nav || !panels || !active) throw new Error("Missing Settings layout");
      const navRect = nav.getBoundingClientRect();
      const panelRect = panels.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      return {
        rootClientWidth: document.documentElement.clientWidth,
        rootScrollWidth: document.documentElement.scrollWidth,
        navBottom: Math.round(navRect.bottom),
        panelTop: Math.round(panelRect.top),
        activeLeft: Math.round(activeRect.left),
        activeRight: Math.round(activeRect.right),
        navLeft: Math.round(navRect.left),
        navRight: Math.round(navRect.right),
      };
    });

    expect(layout.rootScrollWidth).toBeLessThanOrEqual(layout.rootClientWidth + 1);
    expect(layout.panelTop).toBeGreaterThanOrEqual(layout.navBottom);
    expect(layout.activeLeft).toBeGreaterThanOrEqual(layout.navLeft - 1);
    expect(layout.activeRight).toBeLessThanOrEqual(layout.navRight + 1);
  });

  test("re-centers the active section after resizing from tablet to mobile", async ({ page }) => {
    await page.goto("/settings/agent");
    const nav = page.getByRole("navigation", { name: "Settings sections" });
    const active = nav.getByRole("link", { name: "AI & Agent" });
    await expect(active).toHaveAttribute("aria-current", "page");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(async () =>
        active.evaluate((element) => {
          const item = element.getBoundingClientRect();
          const container = element.parentElement?.getBoundingClientRect();
          return container
            ? item.left >= container.left - 1 && item.right <= container.right + 1
            : false;
        })
      )
      .toBe(true);

    const metrics = await nav.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      scrollLeft: element.scrollLeft,
      rootClientWidth: document.documentElement.clientWidth,
      rootScrollWidth: document.documentElement.scrollWidth,
    }));
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
    expect(metrics.scrollLeft).toBeGreaterThan(0);
    expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
  });
});
