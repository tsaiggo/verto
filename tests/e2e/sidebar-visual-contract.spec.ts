import { expect, test } from "playwright/test";

test.describe("Desktop single sidebar visual contract", () => {
  test.use({ colorScheme: "light", viewport: { width: 1280, height: 800 } });

  test("uses one expanded panel and gives the released width to the workspace", async ({
    page,
  }) => {
    await page.goto("/library");
    const sidebar = page.getByTestId("workspace-shell");
    await expect(sidebar).toHaveAttribute("data-collapsed", "false");
    await expect(page.getByRole("navigation", { name: "App navigation" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Workspace navigation" })).toHaveCount(1);
    for (const label of ["Home", "Library", "Inbox", "Insights"]) {
      const link = sidebar.getByRole("link", { name: label, exact: true });
      await expect(link).toHaveCount(1);
      await expect(link).toBeVisible();
      await expect(link).toHaveText(label);
    }

    const metrics = await sidebar.evaluate((element) => {
      const sidebarRect = element.getBoundingClientRect();
      const panel = element.querySelector<HTMLElement>('[data-testid="workspace-shell-panel"]')!;
      const topbar = document.querySelector<HTMLElement>(".vx-topbar")!;
      return {
        sidebarWidth: sidebarRect.width,
        sidebarRight: sidebarRect.right,
        panelWidth: panel.getBoundingClientRect().width,
        topbarLeft: topbar.getBoundingClientRect().left,
        workspaceBorder: Number.parseFloat(
          getComputedStyle(document.querySelector<HTMLElement>("[data-work-surface]")!)
            .borderLeftWidth
        ),
        sidebarClientWidth: element.clientWidth,
        sidebarScrollWidth: element.scrollWidth,
        rootClientWidth: document.documentElement.clientWidth,
        rootScrollWidth: document.documentElement.scrollWidth,
      };
    });

    expect(metrics.sidebarWidth).toBeCloseTo(232, 0);
    expect(metrics.panelWidth).toBeCloseTo(232, 0);
    expect(metrics.topbarLeft).toBeCloseTo(metrics.sidebarRight + metrics.workspaceBorder, 0);
    expect(metrics.sidebarScrollWidth).toBeLessThanOrEqual(metrics.sidebarClientWidth + 1);
    expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
  });

  test("keeps the collapsed rail compact and fully usable", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();
    await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
    await expect(page.getByTestId("workspace-shell")).toHaveAttribute("data-collapsed", "true");
    await expect(page.getByRole("navigation", { name: "Workspace navigation" })).toHaveCount(0);

    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const canvas = document.querySelector<HTMLElement>("[data-shell-root]")!;
      const rail = document.querySelector<HTMLElement>(
        '[data-shell-rail] nav[aria-label="App navigation"]'
      )!;
      const activeItem = rail.querySelector<HTMLElement>('[aria-current="page"]')!;
      const searchCommand = rail.querySelector<HTMLElement>('[aria-label="Search"]')!;
      const inbox = rail.querySelector<HTMLElement>('[aria-label="Inbox"]')!;
      const activeRect = activeItem.getBoundingClientRect();
      const searchRect = searchCommand.getBoundingClientRect();
      const inboxRect = inbox.getBoundingClientRect();

      return {
        railWidth: rail.getBoundingClientRect().width,
        sidebarWidth: document
          .querySelector<HTMLElement>('[data-testid="workspace-shell"]')!
          .getBoundingClientRect().width,
        canvasBackground: getComputedStyle(canvas).backgroundColor,
        railBackground: getComputedStyle(rail).backgroundColor,
        railClientWidth: rail.clientWidth,
        railScrollWidth: rail.scrollWidth,
        activeBackground: getComputedStyle(activeItem).backgroundColor,
        activeWidth: activeRect.width,
        activeHeight: activeRect.height,
        searchWidth: searchRect.width,
        searchHeight: searchRect.height,
        inboxWidth: inboxRect.width,
        inboxHeight: inboxRect.height,
        rootClientWidth: root.clientWidth,
        rootScrollWidth: root.scrollWidth,
      };
    });

    expect(metrics.railWidth).toBeCloseTo(56, 0);
    expect(metrics.sidebarWidth).toBeCloseTo(56, 0);
    expect(metrics.canvasBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(metrics.railBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(metrics.activeBackground).not.toBe(metrics.railBackground);
    expect(metrics.activeWidth).toBeCloseTo(35, 0);
    expect(metrics.activeHeight).toBeCloseTo(35, 0);
    expect(metrics.searchWidth).toBeCloseTo(35, 0);
    expect(metrics.searchHeight).toBeCloseTo(35, 0);
    expect(metrics.inboxWidth).toBeCloseTo(35, 0);
    expect(metrics.inboxHeight).toBeCloseTo(35, 0);
    expect(metrics.railScrollWidth).toBeLessThanOrEqual(metrics.railClientWidth + 1);
    expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
  });
});

test.describe("Desktop sidebar preferences", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("shows one set of primary links and preserves sidebar preferences across routes and reloads", async ({
    page,
  }) => {
    await page.goto("/library");
    const sidebar = page.getByTestId("workspace-shell");
    const panel = page.getByTestId("workspace-unified-panel");
    const compactNavigation = page.getByRole("navigation", { name: "App navigation" });
    const expandedNavigation = page.getByRole("navigation", { name: "Workspace navigation" });

    const expectPrimaryAndUtilities = async () => {
      for (const label of ["Home", "Library", "Inbox", "Insights"]) {
        await expect(sidebar.getByRole("link", { name: label, exact: true })).toHaveCount(1);
        await expect(sidebar.getByRole("link", { name: label, exact: true })).toBeVisible();
      }
      for (const [label, href] of [
        ["Agent", "/agent"],
        ["Help", "/help"],
        ["Settings", "/settings"],
      ] as const) {
        const link = sidebar.getByRole("link", { name: label, exact: true });
        await expect(link).toHaveCount(1);
        await expect(link).toHaveAttribute("href", href);
        await expect(link).toBeVisible();
      }
      await expect(sidebar.getByRole("button", { name: "Theme", exact: true })).toBeVisible();
    };

    await expect(sidebar).toHaveAttribute("data-collapsed", "false");
    await expect(panel).toBeVisible();
    await expect(compactNavigation).toHaveCount(0);
    await expect(expandedNavigation).toHaveCount(1);
    await expectPrimaryAndUtilities();
    await expect(sidebar.getByRole("link", { name: "Settings", exact: true })).toHaveText(
      "Settings"
    );
    await expect(sidebar.getByRole("link", { name: "Workspace preferences" })).toHaveCount(0);
    await sidebar.getByRole("button", { name: "Verto workspace menu" }).click();
    await expect(page.getByRole("menuitem", { name: "Workspace preferences" })).toHaveAttribute(
      "href",
      "/settings/general"
    );
    await page.keyboard.press("Escape");

    await sidebar.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
    await expect(sidebar).toHaveAttribute("data-collapsed", "true");
    await expect(panel).toBeHidden();
    await expect(expandedNavigation).toHaveCount(0);
    await expect(compactNavigation).toHaveCount(1);
    await expectPrimaryAndUtilities();
    await expect(
      sidebar.getByRole("button", { name: "Expand sidebar", exact: true })
    ).toBeFocused();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("verto:labs-sidebar:collapsed")))
      .toBe("1");

    await compactNavigation.getByRole("link", { name: "Insights", exact: true }).click();
    await expect(page).toHaveURL(/\/studio$/);
    await expect(sidebar).toHaveAttribute("data-collapsed", "true");
    await page.reload();
    await expect(sidebar).toHaveAttribute("data-collapsed", "true");
    await expectPrimaryAndUtilities();

    const expand = sidebar.getByRole("button", { name: "Expand sidebar", exact: true });
    await expand.focus();
    await expand.press("Enter");
    await expect(sidebar).toHaveAttribute("data-collapsed", "false");
    await expect(panel).toBeVisible();
    await expect(compactNavigation).toHaveCount(0);
    await expect(
      expandedNavigation.getByRole("link", { name: "Insights", exact: true })
    ).toHaveAttribute("aria-current", "page");
    await expect(expandedNavigation.locator('a[aria-current="page"]')).toHaveCount(1);
    await expectPrimaryAndUtilities();
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("verto:labs-sidebar:collapsed")))
      .toBe("0");
    await page.reload();
    await expect(sidebar).toHaveAttribute("data-collapsed", "false");
    await expect(compactNavigation).toHaveCount(0);
  });
});

test("keeps mobile footer tools usable and closes navigation for workspace preferences", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/library");
  const open = page.getByRole("button", { name: "Open navigation" });
  const drawer = page.getByRole("dialog", { name: "Primary navigation" });
  await open.click();
  const settings = drawer.getByRole("link", { name: "Settings", exact: true });
  await expect(settings).toHaveText("Settings");
  await expect(settings).toHaveAttribute("href", "/settings");
  await drawer.getByRole("button", { name: "Theme", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(drawer).toBeVisible();
  await expect(settings).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Workspace preferences" })).toHaveCount(0);
  await drawer.getByRole("button", { name: "Verto workspace menu" }).click();
  const preferences = page.getByRole("menuitem", { name: "Workspace preferences" });
  await expect(preferences).toHaveAttribute("href", "/settings/general");
  await preferences.click();
  await expect(page).toHaveURL(/\/settings\/general$/);
  await expect(drawer).toBeHidden();
  await open.click();
  await drawer.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(drawer).toBeHidden();
});
