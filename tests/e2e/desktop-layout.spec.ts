import { expect, test } from "playwright/test";

const desktopWidths = [1024, 1280, 1440];
const routes = ["/", "/library", "/integrations", "/agent", "/read/demo"];

for (const width of desktopWidths) {
  test.describe(`${width}px desktop`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const route of routes) {
      test(`${route} keeps the application frame free of horizontal overflow`, async ({ page }) => {
        await page.goto(route);
        await expect(page.locator("#main-content")).toBeVisible();

        const metrics = await page.evaluate(() => {
          const root = document.documentElement;
          const content = document.querySelector<HTMLElement>(".vx-content, .app-content");
          return {
            rootClientWidth: root.clientWidth,
            rootScrollWidth: root.scrollWidth,
            contentClientWidth: content?.clientWidth ?? 0,
          };
        });

        expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
        expect(metrics.contentClientWidth).toBeGreaterThan(0);
      });
    }
  });
}

test.describe("Borderless desktop shell", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const route of routes) {
    test(`${route} starts the application shell at the top of the viewport`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("#main-content")).toBeVisible();

      const metrics = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        const shell = document.querySelector<HTMLElement>("[data-shell-root]")!;
        const rail = document.querySelector<HTMLElement>("[data-shell-rail]")!;
        const surface = document.querySelector<HTMLElement>("[data-work-surface]")!;
        const pageScroll = [...document.querySelectorAll<HTMLElement>("[data-page-scroll]")].find(
          (element) => element.clientWidth > 0 && element.clientHeight > 0
        );
        const scrollOwner = pageScroll ?? document.querySelector<HTMLElement>("#main-content")!;
        const shellRect = shell.getBoundingClientRect();
        const railRect = rail.getBoundingClientRect();
        const surfaceRect = surface.getBoundingClientRect();
        const scrollOwnerRect = scrollOwner.getBoundingClientRect();
        const surfaceStyle = getComputedStyle(surface);
        const scrollOwnerStyle = getComputedStyle(scrollOwner);

        return {
          menuBarCount: document.querySelectorAll(".codex-menu-bar").length,
          hasTitlebarClass: root.classList.contains("has-titlebar"),
          rootClientWidth: root.clientWidth,
          rootScrollWidth: root.scrollWidth,
          rootClientHeight: root.clientHeight,
          rootScrollHeight: root.scrollHeight,
          bodyClientWidth: body.clientWidth,
          bodyScrollWidth: body.scrollWidth,
          bodyClientHeight: body.clientHeight,
          bodyScrollHeight: body.scrollHeight,
          shellClientWidth: shell.clientWidth,
          shellScrollWidth: shell.scrollWidth,
          shellTop: shellRect.top,
          shellBottom: shellRect.bottom,
          shellHeight: shellRect.height,
          railTop: railRect.top,
          railRight: railRect.right,
          railWidth: railRect.width,
          surfaceTop: surfaceRect.top,
          surfaceLeft: surfaceRect.left,
          surfaceBottom: surfaceRect.bottom,
          surfaceTopLeftRadius: Number.parseFloat(surfaceStyle.borderTopLeftRadius),
          surfaceBottomLeftRadius: Number.parseFloat(surfaceStyle.borderBottomLeftRadius),
          surfaceOverflow: surfaceStyle.overflow,
          scrollOwnerTop: scrollOwnerRect.top,
          scrollOwnerBottom: scrollOwnerRect.bottom,
          scrollOwnerOverflowY: scrollOwnerStyle.overflowY,
          scrollOwnerClientWidth: scrollOwner.clientWidth,
          scrollOwnerScrollWidth: scrollOwner.scrollWidth,
          scrollOwnerClientHeight: scrollOwner.clientHeight,
          scrollOwnerScrollHeight: scrollOwner.scrollHeight,
        };
      });

      expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
      expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.bodyClientWidth + 1);
      expect(metrics.rootScrollHeight).toBeLessThanOrEqual(metrics.rootClientHeight + 1);
      expect(metrics.bodyScrollHeight).toBeLessThanOrEqual(metrics.bodyClientHeight + 1);
      expect(metrics.shellScrollWidth).toBeLessThanOrEqual(metrics.shellClientWidth + 1);
      expect(metrics.menuBarCount).toBe(0);
      expect(metrics.hasTitlebarClass).toBe(false);
      expect(metrics.shellTop).toBeCloseTo(0, 0);
      expect(metrics.shellBottom).toBeCloseTo(800, 0);
      expect(metrics.shellHeight).toBeCloseTo(800, 0);
      expect(metrics.railTop).toBeCloseTo(0, 0);
      expect(metrics.railWidth).toBeGreaterThanOrEqual(206);
      expect(metrics.surfaceTop).toBeCloseTo(0, 0);
      expect(metrics.surfaceLeft).toBeCloseTo(metrics.railRight, 0);
      expect(metrics.surfaceBottom).toBeCloseTo(800, 0);
      expect(metrics.surfaceTopLeftRadius).toBeGreaterThanOrEqual(12);
      expect(metrics.surfaceBottomLeftRadius).toBe(0);
      expect(metrics.surfaceOverflow).toBe("hidden");
      expect(metrics.scrollOwnerTop).toBeGreaterThanOrEqual(metrics.surfaceTop);
      expect(metrics.scrollOwnerBottom).toBeLessThanOrEqual(metrics.surfaceBottom + 1);
      expect(metrics.scrollOwnerOverflowY).toBe("auto");
      expect(metrics.scrollOwnerClientWidth).toBeGreaterThan(0);
      expect(metrics.scrollOwnerScrollWidth).toBeLessThanOrEqual(
        metrics.scrollOwnerClientWidth + 1
      );
      expect(metrics.scrollOwnerClientHeight).toBeGreaterThan(0);
      expect(metrics.scrollOwnerScrollHeight).toBeGreaterThanOrEqual(
        metrics.scrollOwnerClientHeight
      );
    });
  }
});

test.describe("Document navigation status", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("does not claim syncing or saving state without a live backend", async ({ page }) => {
    await page.goto("/help");

    await expect(page.getByText("Synced", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("All changes saved")).toHaveCount(0);
  });
});

test.describe("Product top bar actions", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("offers real product destinations instead of an inert overflow button", async ({ page }) => {
    await page.goto("/library");

    await page.getByRole("button", { name: "Product actions" }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: "Sources" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Settings" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Help" })).toBeVisible();

    await menu.getByRole("menuitem", { name: "Sources" }).click();
    await expect(page).toHaveURL(/\/integrations$/);
  });
});

test.describe("Inbox navigation count", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("only shows attention drawn from real Inbox items", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "verto:inbox",
        JSON.stringify({
          items: [
            {
              id: "unread",
              feedUrl: "https://example.com/feed.xml",
              sourceName: "Example",
              title: "Unread",
              url: "https://example.com/unread",
              status: "unread",
              createdAt: "2026-07-01T00:00:00.000Z",
            },
            {
              id: "reading",
              feedUrl: "https://example.com/feed.xml",
              sourceName: "Example",
              title: "Reading",
              url: "https://example.com/reading",
              status: "reading",
              createdAt: "2026-07-01T00:00:00.000Z",
            },
            {
              id: "read",
              feedUrl: "https://example.com/feed.xml",
              sourceName: "Example",
              title: "Read",
              url: "https://example.com/read",
              status: "read",
              createdAt: "2026-07-01T00:00:00.000Z",
            },
          ],
        })
      );
    });

    await page.goto("/");

    const inbox = page
      .getByRole("navigation", { name: "Primary workspace navigation" })
      .getByRole("link", { name: /Inbox/ });
    await expect(inbox.locator(".vx-nav-badge")).toHaveText("2");
    await page.locator(".codex-thread-library-summary > summary").click();
    await expect(page.getByText("1 unread article", { exact: true })).toBeVisible();
    await expect(page.getByText("1 article in progress", { exact: true })).toBeVisible();
  });
});

test.describe("Home dashboard honesty", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("does not invent agent work or inbox triage", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Agent summarised 4 documents", { exact: true })).toHaveCount(0);
    await expect(page.getByText("5 highlights without notes", { exact: true })).toHaveCount(0);
    await expect(
      page.getByText(
        "The workspace is using real library data. Source links remain available from the rail, the task environment, and the composer so the wide task canvas does not remove any Verto workflow.",
        { exact: true }
      )
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Verto library is ready" })).toBeVisible();
  });
});

test.describe("Tag navigation", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("filters the library with the selected real tag", async ({ page }) => {
    await page.goto("/tags");

    const demoTag = page.locator('a[href="/library?tag=demo"]');
    await expect(demoTag).toHaveCount(1);
    await demoTag.click();

    await expect(page).toHaveURL(/\/library\?tag=demo$/);
    await expect(page.getByRole("combobox", { name: "Filter by tag" })).toHaveValue("demo");
    await expect(page.getByText("Agent-native Workflows", { exact: true })).toHaveCount(0);
  });
});

test.describe("Library source navigation", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("labels the bundled demo and sends readers to connect their own folder", async ({
    page,
  }) => {
    await page.goto("/library");

    const source = page.getByRole("region", { name: "Library source" });
    await expect(source.getByText("Included demo", { exact: true })).toBeVisible();
    await expect(source.getByText("Verto demo workspace", { exact: true })).toBeVisible();
    await expect(source.getByRole("link", { name: "Connect a folder" })).toHaveAttribute(
      "href",
      "/integrations#local-files"
    );

    await source.getByRole("link", { name: "Connect a folder" }).click();
    await expect(page).toHaveURL(/\/integrations#local-files$/);
  });

  test("applies a source preselected by a dashboard section link", async ({ page }) => {
    await page.goto("/library?source=Workspace");

    await expect(page.getByRole("combobox", { name: "Filter by source" })).toHaveValue("Workspace");
    await expect(page.getByRole("list", { name: "Documents" })).toBeVisible();
  });
});

test.describe("Recent source truth", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("shows configured recent documents before a local folder is selected", async ({ page }) => {
    await page.goto("/recent");

    await expect(page.getByRole("heading", { name: "Recent" })).toBeVisible();
    const recentDocument = page
      .locator("#main-content")
      .getByRole("link", { name: /Verto Feature Demo/ });
    await expect(recentDocument).toHaveCount(1);
    await expect(recentDocument).toBeVisible();
    await expect(recentDocument).toHaveAttribute("href", "/read/demo");
  });
});

test.describe("Onboarding honesty", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("does not claim unconfigured sources or AI are connected", async ({ page }) => {
    await page.goto("/onboarding/ready");

    await expect(page.getByRole("heading", { name: "Choose your next step" })).toBeVisible();
    await expect(page.getByText("Source connected", { exact: true })).toHaveCount(0);
    await expect(page.getByText("AI provider linked", { exact: true })).toHaveCount(0);
    const connectSource = page.getByRole("link", { name: "Connect a source" });
    await expect(connectSource).toBeVisible();
    await expect(connectSource).toHaveClass(/v-btn--primary/);
    await expect(page.getByRole("link", { name: "Set up AI later" })).toBeVisible();

    await connectSource.click();
    await expect(page).toHaveURL(/\/integrations$/);
  });
});

test.describe("Settings honesty", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("persists the working theme control and only shows supported AI setup", async ({ page }) => {
    await page.goto("/settings/appearance");

    await page.getByRole("tab", { name: "Dark" }).click();
    await expect
      .poll(() => page.locator("html").evaluate((html) => html.classList.contains("dark")))
      .toBe(true);
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem("theme"))).toBe("dark");

    await page.getByRole("link", { name: "AI & Agent" }).click();
    await expect(page).toHaveURL(/\/settings\/agent$/);
    await expect(page.getByText("Assistant provider", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "Verto currently supports GitHub Models when that provider is enabled in the build."
      )
    ).toBeVisible();
    await expect(page.getByText("Claude Opus", { exact: true })).toHaveCount(0);
  });
});

// Active phone and tablet release gates live in responsive-layout.spec.ts.
