import { expect, test, type Locator } from "playwright/test";

async function expectSingleFooter(sidebar: Locator) {
  await expect(sidebar.getByRole("link", { name: "Agent", exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole("button", { name: "Verto workspace menu" })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Settings", exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Help", exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole("button", { name: "Theme", exact: true })).toHaveCount(0);
  const profile = sidebar.getByRole("button", { name: "Verto menu", exact: true });
  await expect(profile).toHaveCount(1);
  await expect(profile).toBeVisible();
  await expect(profile).toHaveAttribute("data-testid", "sidebar-profile-menu");
  const bottomGap = await profile.evaluate((element) => {
    const shell = element.closest("[data-shell-rail]")!;
    return shell.getBoundingClientRect().bottom - element.getBoundingClientRect().bottom;
  });
  expect(bottomGap).toBeGreaterThanOrEqual(0);
  expect(bottomGap).toBeLessThanOrEqual(32);
}

async function expectFooterMenu(menu: Locator) {
  const items = menu.getByRole("menuitem");
  await expect(items).toHaveCount(4);
  for (const [index, label] of ["Settings", "Theme", "Help", "Manage sources"].entries()) {
    await expect(items.nth(index)).toHaveAccessibleName(label);
  }
  for (const [label, href] of [
    ["Settings", "/settings"],
    ["Help", "/help"],
    ["Manage sources", "/integrations"],
  ] as const) {
    await expect(menu.getByRole("menuitem", { name: label, exact: true })).toHaveAttribute(
      "href",
      href
    );
  }
  await expect(menu.getByRole("separator")).toHaveCount(1);
  await expect(menu.getByRole("menuitem", { name: "Preferences", exact: true })).toHaveCount(0);
}

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
    const header = sidebar.getByTestId("workspace-unified-panel").locator("header");
    const wordmark = header.getByRole("link", { name: "Verto", exact: true });
    await expect(wordmark).toHaveAttribute("href", "/");
    await expect(wordmark).toHaveText("Verto");
    await expect(wordmark.locator("svg, img, [aria-hidden='true']")).toHaveCount(0);
    await expect(header.getByRole("button", { name: "Verto menu", exact: true })).toHaveCount(0);
    await expectSingleFooter(sidebar);

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
    await expectSingleFooter(page.getByTestId("workspace-shell"));

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
      await expectSingleFooter(sidebar);
    };

    await expect(sidebar).toHaveAttribute("data-collapsed", "false");
    await expect(panel).toBeVisible();
    await expect(compactNavigation).toHaveCount(0);
    await expect(expandedNavigation).toHaveCount(1);
    await expectPrimaryAndUtilities();
    const profile = sidebar.getByRole("button", { name: "Verto menu", exact: true });
    const profileBox = await profile.boundingBox();
    await profile.click();
    const menu = page.getByRole("menu");
    await expect(menu).toHaveAttribute("data-side", "top");
    const menuBox = await menu.boundingBox();
    expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(profileBox!.y);
    await expectFooterMenu(menu);
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
    const compactProfile = compactNavigation.getByRole("button", {
      name: "Verto menu",
      exact: true,
    });
    await compactProfile.focus();
    await compactProfile.press("Enter");
    await expect(page.getByRole("menuitem", { name: "Settings", exact: true })).toBeFocused();
    await expect(page.getByRole("menu")).toHaveAttribute("data-side", "top");
    await expectFooterMenu(page.getByRole("menu"));
    await page.keyboard.press("Escape");
    await expect(compactProfile).toBeFocused();
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

test("keeps mobile footer tools in the avatar menu and closes navigation for destinations", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/library");
  const open = page.getByRole("button", { name: "Open navigation" });
  const drawer = page.getByRole("dialog", { name: "Primary navigation" });
  await open.click();
  await expectSingleFooter(drawer);
  const profile = drawer.getByRole("button", { name: "Verto menu", exact: true });
  const profileBox = await profile.boundingBox();
  expect(profileBox!.width).toBeGreaterThanOrEqual(44);
  expect(profileBox!.height).toBeGreaterThanOrEqual(44);
  await profile.click();
  const menu = page.getByRole("menu");
  await expect(menu).toHaveAttribute("data-side", "top");
  await expectFooterMenu(menu);
  for (const item of await menu.getByRole("menuitem").all()) {
    const size = await item.boundingBox();
    expect(size!.height).toBeGreaterThanOrEqual(44);
  }
  await menu.getByRole("menuitem", { name: "Theme", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(menu).toBeVisible();
  await expect(page.getByTestId("workspace-shell-sheet")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(drawer).toBeVisible();
  await expect(profile).toBeFocused();

  for (const [label, route] of [
    ["Help", /\/help$/],
    ["Settings", /\/settings$/],
    ["Manage sources", /\/integrations$/],
  ] as const) {
    await profile.click();
    await menu.getByRole("menuitem", { name: label, exact: true }).click();
    await expect(page).toHaveURL(route);
    await expect(menu).toBeHidden();
    await expect(drawer).toBeHidden();
    if (label !== "Manage sources") await open.click();
  }
});
