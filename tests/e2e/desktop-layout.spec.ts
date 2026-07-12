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
test.describe("Windows desktop shell", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const route of routes) {
    test(`${route} keeps scrolling inside the app shell when the title bar is active`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page.locator("#main-content")).toBeVisible();

      const metrics = await page.evaluate(() => {
        document.documentElement.classList.add("has-titlebar");

        const root = document.documentElement;
        const body = document.body;
        const shell = document.querySelector<HTMLElement>(".vx-shell, .app-shell");

        return {
          rootClientHeight: root.clientHeight,
          rootScrollHeight: root.scrollHeight,
          bodyClientHeight: body.clientHeight,
          bodyScrollHeight: body.scrollHeight,
          bodyOverflow: getComputedStyle(body).overflowY,
          shellHeight: shell?.getBoundingClientRect().height ?? 0,
        };
      });

      expect(metrics.rootScrollHeight).toBeLessThanOrEqual(metrics.rootClientHeight + 1);
      expect(metrics.bodyScrollHeight).toBeLessThanOrEqual(metrics.bodyClientHeight + 1);
      expect(metrics.bodyOverflow).toBe("hidden");
      expect(metrics.shellHeight).toBeCloseTo(760, 0);
    });
  }
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

  test("only shows a badge for real Inbox items that need attention", async ({ page }) => {
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

    const inbox = page.getByRole("navigation", { name: "Primary" }).getByRole("link", {
      name: /Inbox/,
    });
    await expect(inbox.locator(".vx-nav-badge")).toHaveText("2");
  });
});

test.describe("Onboarding honesty", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("does not claim unconfigured sources or AI are connected", async ({ page }) => {
    await page.goto("/onboarding/ready");

    await expect(page.getByRole("heading", { name: "Choose your next step" })).toBeVisible();
    await expect(page.getByText("Source connected", { exact: true })).toHaveCount(0);
    await expect(page.getByText("AI provider linked", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Connect a source" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Set up AI later" })).toBeVisible();

    await page.getByRole("link", { name: "Connect a source" }).click();
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
    await expect(page.getByText("GitHub Models", { exact: false })).toBeVisible();
    await expect(page.getByText("Claude Opus", { exact: true })).toHaveCount(0);
  });
});

test.describe("390px mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps dashboard summary cards content-dense", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();

    const heights = await page
      .locator(".home-row-3 .home-card")
      .evaluateAll((cards) => cards.map((card) => Math.round(card.getBoundingClientRect().height)));

    expect(heights).toHaveLength(3);
    expect(Math.max(...heights)).toBeLessThan(280);
  });

  test("keeps the reader usable and exposes the primary navigation as a modal", async ({
    page,
  }) => {
    await page.goto("/read/demo");
    await expect(page.locator("#main-content")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const content = document.querySelector<HTMLElement>(".app-content");
      return {
        rootClientWidth: root.clientWidth,
        rootScrollWidth: root.scrollWidth,
        contentClientWidth: content?.clientWidth ?? 0,
      };
    });

    expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
    expect(metrics.contentClientWidth).toBeGreaterThanOrEqual(360);

    await page.getByRole("button", { name: "Open navigation" }).click();
    const navigation = page.getByRole("dialog", { name: "Primary navigation" });
    await expect(navigation).toBeVisible();

    await navigation.getByRole("link", { name: "Library" }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(navigation).not.toBeVisible();
  });
});
