import { expect, test, type Page } from "playwright/test";

const assistantKind = (process.env.NEXT_PUBLIC_VERTO_ASSISTANT ?? "").trim().toLowerCase();
const desktopRoutes = [
  ["home", "/"],
  ["reader", "/read/demo"],
  ["library", "/library"],
  ["agent", "/agent"],
  ["sources", "/integrations"],
  ["settings", "/settings/appearance"],
  ["not-found", "/definitely-missing-verto-route"],
] as const;
const darkRoutes = desktopRoutes;
const mobileRoutes = [
  ["home", "/"],
  ["reader", "/read/demo"],
  ["library", "/library"],
  ["agent", "/agent"],
  ["sources", "/integrations"],
  ["settings", "/settings/agent"],
  ["not-found", "/definitely-missing-verto-route"],
] as const;

const screenshotOptions = {
  animations: "disabled" as const,
  caret: "hide" as const,
  maxDiffPixelRatio: 0.002,
  scale: "css" as const,
};

async function installTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript((choice) => {
    // Every route in a visual loop should start from the same clean product
    // state. Reader progress, generated Agent threads, source selections, and
    // persisted overlays otherwise leak into screenshots captured later in
    // the same browser context.
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("theme", choice);
  }, theme);
}

async function prepareRoute(page: Page, route: string) {
  await page.goto(route);
  await expect(page.locator("#main-content")).toBeVisible();

  if (route.startsWith("/read/")) {
    await expect(page.locator(".doc-title")).toBeVisible();
    await expect(page.locator("[data-article]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reading settings" })).toBeEnabled();

    const viewport = page.viewportSize();
    const companionLauncher =
      viewport && viewport.width >= 1200
        ? page
            .locator("[data-reading-companion-launcher-host]")
            .getByRole("button", { name: "Open reading companion" })
        : page.locator(".chat-col-fab");
    await expect(companionLauncher).toBeVisible();
  } else if (route === "/") {
    await expect(page.locator(".codex-home-composer")).toBeVisible();
  } else if (route === "/library") {
    await expect(page.locator(".lib-table")).toBeVisible();
  } else if (route === "/agent") {
    await expect(page.getByRole("complementary", { name: "Conversations" })).toBeVisible();
    // Mobile intentionally hides the compact session metadata, but its text
    // still proves that the reused server was built with the mock provider.
    await expect(page.getByText("Demo provider", { exact: true })).toHaveCount(1);
  } else if (route === "/integrations") {
    await expect(page.locator("#local-files")).toBeVisible();
    await expect(page.locator("#rss-feeds")).toBeVisible();
  } else if (route.startsWith("/settings")) {
    const nav = page.getByRole("navigation", { name: "Settings sections" });
    const activeSection = nav.locator('a[aria-current="page"]');
    await expect(page.locator('[id^="settings-"][aria-label$=" settings"]')).toBeVisible();
    await expect(activeSection).toBeInViewport({ ratio: 1 });

    if (route === "/settings/appearance") {
      const expectedTheme = await page
        .locator("html")
        .evaluate((root) => (root.classList.contains("dark") ? "Dark" : "Light"));
      await expect(
        page.getByRole("radio", { name: new RegExp(`^${expectedTheme}`) })
      ).toBeChecked();
    }
  } else {
    await expect(page.locator(".codex-route-state")).toBeVisible();
  }

  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation-delay:0s!important;animation-duration:0s!important;transition:none!important;caret-color:transparent!important}",
  });
}

async function expectStableScreenshot(page: Page, name: string) {
  await expect(page).toHaveScreenshot(name, {
    ...screenshotOptions,
    // These strings are derived from server time and legitimately change as
    // content crosses relative-date boundaries. Keep their geometry covered
    // without turning the visual suite into a clock test.
    mask: [page.locator(".home-list-meta, .lib-cell-updated")],
    maskColor: "#7f7f7f",
  });
}

test.skip(
  assistantKind !== "mock",
  "Codex visual baselines require the deterministic mock assistant provider."
);

test.describe("Codex desktop visual regression", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("keeps the light core surfaces on the approved baseline", async ({ page }) => {
    await installTheme(page, "light");

    for (const [name, route] of desktopRoutes) {
      await prepareRoute(page, route);
      await expectStableScreenshot(page, "desktop-light-" + name + ".png");
    }
  });

  test("keeps the dark product surfaces on the approved baseline", async ({ page }) => {
    await installTheme(page, "dark");

    for (const [name, route] of darkRoutes) {
      await prepareRoute(page, route);
      await expect(page.locator("html")).toHaveClass(/dark/);
      await expectStableScreenshot(page, "desktop-dark-" + name + ".png");
    }
  });

  test("keeps preferences and the Reader tools companion polished", async ({ page }) => {
    await installTheme(page, "light");
    await prepareRoute(page, "/read/demo");
    await page.getByRole("button", { name: "Reading settings" }).click();
    await expect(page.getByTestId("reading-settings-popover")).toBeVisible();
    await expectStableScreenshot(page, "desktop-reading-settings.png");

    await page.keyboard.press("Escape");
    await page
      .locator("[data-reading-companion-launcher-host]")
      .getByRole("button", { name: "Open reading companion" })
      .click();
    await expect(
      page.locator("[data-reading-companion-panel-host]").getByRole("region", {
        name: "Reading companion",
      })
    ).toBeVisible();
    await expectStableScreenshot(page, "desktop-reading-companion.png");
  });
});

test.describe("Codex mobile visual regression", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps core surfaces within the approved mobile baseline", async ({ page }) => {
    await installTheme(page, "light");

    for (const [name, route] of mobileRoutes) {
      await prepareRoute(page, route);
      await expectStableScreenshot(page, "mobile-light-" + name + ".png");
    }

    await prepareRoute(page, "/");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("dialog", { name: "Primary navigation" })).toBeVisible();
    await expectStableScreenshot(page, "mobile-navigation-open.png");
  });

  test("keeps the mobile reader companion modal and complete", async ({ page }) => {
    await installTheme(page, "dark");
    await prepareRoute(page, "/read/demo");

    await page.getByRole("button", { name: "Open reading companion" }).click();
    await expect(page.getByRole("dialog", { name: "Reading companion" })).toBeVisible();
    await expectStableScreenshot(page, "mobile-dark-reading-companion.png");
  });
});
