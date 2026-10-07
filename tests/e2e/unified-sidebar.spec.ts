import { expect, test, type Locator } from "playwright/test";

const PRIMARY_LINKS = [
  ["Home", "/"],
  ["Library", "/library"],
  ["Inbox", "/inbox"],
  ["Insights", "/studio"],
] as const;

async function expectWorkspaceNavigation(nav: Locator, group: string, current: string | null) {
  await expect(nav.locator('a[data-navigation-level="primary"]')).toHaveCount(4);
  for (const [label, href] of PRIMARY_LINKS) {
    const link = nav.getByRole("link", { name: label, exact: true });
    await expect(link).toHaveAttribute("href", href);
    if (label === group) await expect(link).toHaveAttribute("data-active", "true");
    else await expect(link).not.toHaveAttribute("data-active", "true");
  }
  await expect(nav.locator('a[aria-current="page"]')).toHaveCount(current ? 1 : 0);
  if (current) {
    await expect(nav.getByRole("link", { name: current, exact: true })).toHaveAttribute(
      "aria-current",
      "page"
    );
  }
  await expect(nav.getByText("Tasks", { exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Tasks" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Sources", exact: true })).toHaveCount(0);
}

test.use({ viewport: { width: 1280, height: 800 } });

test("keeps one stable navigation across Mail, RSS Inbox, and Library", async ({ page }) => {
  await page.goto("/mail");
  const nav = page.getByRole("navigation", { name: "Workspace navigation" });
  await expect(page.locator("[data-agent-pane]")).toHaveCount(0);

  await expectWorkspaceNavigation(nav, "Inbox", "Mail");
  await nav.getByRole("link", { name: "RSS Inbox" }).click();
  await expect(page).toHaveURL(/\/inbox$/);
  await expectWorkspaceNavigation(nav, "Inbox", "RSS Inbox");
  await expect(page.locator("[data-unified-sidebar-context]")).toHaveCount(0);
  await expect(page.locator("[data-agent-pane]")).toHaveCount(0);

  await nav.getByRole("link", { name: "Library", exact: true }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expectWorkspaceNavigation(nav, "Library", "Library");
  await expect(page.locator("[data-agent-pane]")).toHaveCount(0);

  await nav.getByRole("link", { name: "Notes", exact: true }).click();
  await expect(page).toHaveURL(/\/library\?view=notes$/);
  await expect(page.getByRole("tab", { name: "Notes" })).toHaveAttribute("data-state", "active");
  await expectWorkspaceNavigation(nav, "Library", "Notes");

  await nav.getByRole("button", { name: "Expand Inbox navigation" }).click();
  await nav.getByRole("link", { name: "Mail", exact: true }).click();
  await expect(page).toHaveURL(/\/mail$/);
  await expectWorkspaceNavigation(nav, "Inbox", "Mail");
  await expect(page.locator("[data-agent-pane]")).toHaveCount(0);
});

test("keeps the Mail connection entry reachable from its sidebar context", async ({ page }) => {
  await page.goto("/mail");
  const sidebar = page.locator('[data-testid="workspace-shell"]');
  const connect = sidebar.getByRole("link", { name: "Connect mail" });
  await expect(connect).toHaveAttribute("href", "/mail#connect");
  await connect.click();

  await expect(page).toHaveURL(/\/mail#connect$/);
  await expect(page.locator("#connect")).toBeVisible();
  const googleConfigured = Boolean(process.env.NEXT_PUBLIC_VERTO_MAIL_GOOGLE_CLIENT_ID);
  const microsoftConfigured = Boolean(process.env.NEXT_PUBLIC_VERTO_MAIL_MICROSOFT_CLIENT_ID);
  const connection = page.locator("#connect");
  await expect(
    connection.getByRole("heading", {
      name:
        googleConfigured || microsoftConfigured ? "Connect your mail" : "Mail is not configured",
      exact: true,
    })
  ).toBeVisible();
  for (const [label, configured] of [
    ["Connect Gmail", googleConfigured],
    ["Connect Outlook", microsoftConfigured],
  ] as const) {
    const button = connection.getByRole("button", { name: label, exact: true });
    if (configured) await expect(button).toBeEnabled();
    else await expect(button).toHaveCount(0);
  }
});

test("starts with only the current group expanded and keeps utility actions reachable", async ({
  page,
}) => {
  await page.goto("/");
  const sidebar = page.locator('[data-testid="workspace-shell"]');
  const nav = sidebar.getByRole("navigation", { name: "Workspace navigation" });
  await expectWorkspaceNavigation(nav, "Home", "Home");
  await expect(sidebar.locator("[data-unified-sidebar-context]")).toHaveCount(0);
  await expect(nav.getByRole("button", { name: "Collapse Home navigation" })).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  await expect(nav.getByRole("link", { name: "Recent", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Notes" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Mail", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "New note", exact: true })).toHaveAttribute(
    "href",
    "/editor"
  );
  const expandLibrary = nav.getByRole("button", { name: "Expand Library navigation" });
  await expandLibrary.focus();
  await expandLibrary.press("Enter");
  await expect(nav.getByRole("link", { name: "Notes" })).toBeVisible();
  await nav.getByRole("button", { name: "Collapse Library navigation" }).click();
  await expect(nav.getByRole("link", { name: "Notes" })).toHaveCount(0);
  await nav.getByRole("button", { name: "Expand Library navigation" }).click();
  await nav.getByRole("link", { name: "Notes", exact: true }).click();
  await expectWorkspaceNavigation(nav, "Library", "Notes");
  await expect(nav.getByRole("button", { name: "Expand Home navigation" })).toHaveAttribute(
    "aria-expanded",
    "false"
  );
  await nav.getByRole("button", { name: "Collapse Library navigation" }).click();
  await expect(nav.getByRole("link", { name: "Library", exact: true })).toHaveAttribute(
    "data-active",
    "true"
  );
  await expect(nav.getByRole("link", { name: "Library", exact: true })).not.toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(nav.locator('a[aria-current="page"]')).toHaveCount(0);

  const workspaceMenu = sidebar.getByRole("button", { name: "Verto workspace menu" });
  await workspaceMenu.click();
  await expect(page.getByRole("menuitem", { name: "Manage sources" })).toHaveAttribute(
    "href",
    "/integrations"
  );
  await expect(page.getByRole("menuitem", { name: "Workspace preferences" })).toHaveAttribute(
    "href",
    "/settings/general"
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(workspaceMenu).toBeFocused();
  await sidebar.getByRole("button", { name: "Open command palette" }).click();
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.keyboard.press("Escape");
  await workspaceMenu.focus();
  await workspaceMenu.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Verto", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  const sources = page.getByRole("menuitem", { name: "Manage sources" });
  await expect(sources).toBeFocused();
  await sources.press("Enter");
  await expect(page).toHaveURL(/\/integrations$/);
});

test("expands the owning group for direct routes without claiming its parent is the current page", async ({
  page,
}) => {
  const nav = page.getByRole("navigation", { name: "Workspace navigation" });
  for (const [route, group, current] of [
    ["/recent", "Home", "Recent"],
    ["/collections", "Library", "Collections"],
    ["/bookmarks", "Library", "Bookmarks"],
    ["/tags", "Library", "Tags"],
    ["/editor", "Library", null],
    ["/read/demo", "Library", null],
    ["/inbox", "Inbox", "RSS Inbox"],
    ["/studio", "Insights", "Insights"],
  ] as const) {
    await page.goto(route);
    await expectWorkspaceNavigation(nav, group, current);
    await expect(page.getByRole("navigation", { name: "App navigation" })).toHaveCount(0);
    if (route === "/inbox" || route === "/studio") {
      await expect(page.locator("[data-unified-sidebar-context]")).toHaveCount(0);
    }
    if (route === "/editor" || route === "/read/demo") {
      await expect(page.getByTestId("workspace-editor-panel")).toHaveCount(0);
      await expect(page.getByTestId("workspace-reader-panel")).toHaveCount(0);
      const documents = page.getByRole("complementary", { name: "Document navigation" });
      await expect(documents).toBeHidden();
      await expect(
        page.getByRole("button", { name: "Toggle document navigation" })
      ).toHaveAttribute("aria-expanded", "false");
    }
    if (group !== "Insights") {
      await expect(
        nav.getByRole("button", { name: `Collapse ${group} navigation` })
      ).toHaveAttribute("aria-expanded", "true");
    }
    for (const other of ["Home", "Library", "Inbox"].filter((candidate) => candidate !== group)) {
      await expect(nav.getByRole("button", { name: `Expand ${other} navigation` })).toHaveAttribute(
        "aria-expanded",
        "false"
      );
    }
  }
});

test("keeps group navigation usable in the mobile drawer", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("verto:labs-sidebar:collapsed", "1"));
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  const drawer = page.getByRole("dialog", { name: "Primary navigation" });
  const nav = drawer.getByRole("navigation", { name: "Workspace navigation" });
  await expect(drawer.getByRole("navigation", { name: "App navigation" })).toHaveCount(0);
  await expect(nav).toHaveCount(1);
  await expect(drawer.getByRole("button", { name: "Collapse sidebar" })).toHaveCount(0);
  await expect(drawer.getByTestId("workspace-shell-sheet")).toHaveAttribute(
    "data-collapsed",
    "false"
  );
  for (const [label] of PRIMARY_LINKS) {
    await expect(drawer.getByRole("link", { name: label, exact: true })).toHaveCount(1);
  }
  for (const label of ["Agent", "Help", "Settings"]) {
    await expect(drawer.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await expectWorkspaceNavigation(nav, "Home", "Home");
  await expect(nav.getByRole("link", { name: "New note", exact: true })).toHaveCount(0);
  const expand = nav.getByRole("button", { name: "Expand Library navigation" });
  const disclosureSize = await expand.boundingBox();
  expect(disclosureSize!.width).toBeGreaterThanOrEqual(44);
  expect(disclosureSize!.height).toBeGreaterThanOrEqual(44);
  await expand.focus();
  await expand.press("Space");
  await expect(nav.getByRole("button", { name: "Collapse Library navigation" })).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  for (const [label, href] of [
    ["Notes", "/library?view=notes"],
    ["Collections", "/collections"],
    ["Bookmarks", "/bookmarks"],
    ["Tags", "/tags"],
  ] as const) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
    await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await nav.getByRole("link", { name: "Library", exact: true }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(drawer).toBeHidden();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expectWorkspaceNavigation(nav, "Library", "Library");
  await nav.getByRole("link", { name: "Notes", exact: true }).click();
  await expect(page).toHaveURL(/\/library\?view=notes$/);
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("heading", { name: "Notes", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expectWorkspaceNavigation(nav, "Library", "Notes");
  await expect(nav.getByRole("button", { name: "Expand Inbox navigation" })).toHaveAttribute(
    "aria-expanded",
    "false"
  );
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
  await page.getByRole("button", { name: "Open navigation" }).click();
  const newNote = nav.getByRole("link", { name: "New note", exact: true });
  await expect(newNote).toHaveAttribute("href", "/editor");
  const newNoteSize = await newNote.boundingBox();
  expect(newNoteSize!.width).toBeGreaterThanOrEqual(44);
  expect(newNoteSize!.height).toBeGreaterThanOrEqual(44);
  await newNote.click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(drawer).toBeHidden();
  const source = page.getByRole("combobox", { name: "MDX source", exact: true });
  await expect(source).toBeEditable();
  await source.fill("# Created from mobile navigation\n\nA new note.\n");
  await expect(page).toHaveURL(/\/editor\?document=/);
  await expect(page.getByRole("status").filter({ hasText: "Saved in this browser" })).toBeVisible();
});

test("keeps account and folder context while the Inbox disclosure changes", async ({ page }) => {
  const account = "microsoft:demo-microsoft-example";
  await page.goto(`/mail?demo=1&account=${encodeURIComponent(account)}&folder=inbox`);
  const nav = page.getByRole("navigation", { name: "Workspace navigation" });
  const mail = page.getByTestId("workspace-mail-panel");
  const address = "alexandria.morgan@product-strategy.northstar-example.com";
  await expect(mail).toContainText(address);
  const archive = mail.getByRole("link", { name: "Archive", exact: true });
  const href = new URL((await archive.getAttribute("href"))!, page.url());
  expect(href.searchParams.get("account")).toBe(account);
  expect(href.searchParams.get("demo")).toBe("1");
  expect(href.searchParams.get("folder")).toBe("archive");
  await archive.click();
  await expect.poll(() => new URL(page.url()).searchParams.get("folder")).toBe("archive");
  await expect(archive).toHaveAttribute("aria-current", "page");
  const currentUrl = page.url();
  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  await expect(mail).toBeHidden();
  const inboxRail = page
    .getByRole("navigation", { name: "App navigation" })
    .getByRole("link", { name: "Inbox", exact: true });
  await expect(inboxRail).toHaveAttribute(
    "href",
    new URL(currentUrl).pathname + new URL(currentUrl).search
  );
  await inboxRail.click();
  await expect(page).toHaveURL(currentUrl);
  await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
  await expect(mail).toContainText(address);
  await expect(archive).toHaveAttribute("aria-current", "page");
  await nav.getByRole("button", { name: "Collapse Inbox navigation" }).click();
  await expect(nav.getByRole("link", { name: "Mail", exact: true })).toHaveCount(0);
  await expect(mail).toContainText(address);
  await expect(archive).toBeVisible();
  await nav.getByRole("button", { name: "Expand Inbox navigation" }).click();
  await expectWorkspaceNavigation(nav, "Inbox", "Mail");
  await expect(page).toHaveURL(currentUrl);
  await mail.getByRole("link", { name: /^Inbox(?: \d+)?$/ }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("folder")).toBe("inbox");
  expect(new URL(page.url()).searchParams.get("account")).toBe(account);
  await expect(mail).toContainText(address);
});

test("keeps Mail account and folder navigation in the single mobile drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const account = "microsoft:demo-microsoft-example";
  await page.goto(`/mail?demo=1&account=${encodeURIComponent(account)}&folder=inbox`);
  const open = page.getByRole("button", { name: "Open navigation" });
  await open.click();
  const drawer = page.getByRole("dialog", { name: "Primary navigation" });
  await expect(drawer.getByRole("navigation", { name: "App navigation" })).toHaveCount(0);
  await expect(drawer.getByRole("navigation", { name: "Workspace navigation" })).toHaveCount(1);
  await expect(drawer).toContainText("alexandria.morgan@product-strategy.northstar-example.com");
  const folders = drawer.getByRole("navigation", { name: "Mail folders" });
  await expect(folders.getByRole("link", { name: /^Inbox(?: \d+)?$/ })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await folders.getByRole("link", { name: "Archive", exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("folder")).toBe("archive");
  expect(new URL(page.url()).searchParams.get("account")).toBe(account);
  await expect(drawer).toBeHidden();

  await open.click();
  await expect(folders.getByRole("link", { name: "Archive", exact: true })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await drawer.getByRole("button", { name: "Close navigation" }).click();
  await expect(drawer).toBeHidden();
  await expect(open).toBeFocused();
});

test("keeps the sidebar and workspace on the same theme", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("theme", "light"));
  await page.goto("/library");

  const readColors = () =>
    page.evaluate(() => {
      const background = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing theme surface: ${selector}`);
        return getComputedStyle(element).backgroundColor;
      };
      return {
        panel: background('[data-testid="workspace-shell-panel"]'),
        workspace: background("[data-work-surface]"),
        selected: background('[aria-label="Workspace navigation"] a[aria-current="page"]'),
      };
    });

  const light = await readColors();
  expect(light.panel).toBe(light.workspace);
  await expect(page.locator("[data-agent-pane]")).toHaveCount(0);

  await page.getByTestId("workspace-shell").getByRole("button", { name: "Theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect.poll(async () => (await readColors()).selected).not.toBe(light.selected);

  const dark = await readColors();
  expect(dark.panel).toBe(dark.workspace);
  expect(dark.panel).not.toBe(light.panel);
  expect(dark.selected).not.toBe(light.selected);

  await page.getByRole("button", { name: "Product actions" }).click();
  await page.getByRole("menuitem", { name: "Agent", exact: true }).click();
  await expect(page).toHaveURL(/\/agent$/);
  await expect(page.locator("[data-agent-workspace]")).toBeVisible();
  const agentColors = await page.evaluate(() => ({
    workspace: getComputedStyle(document.querySelector("[data-work-surface]")!).backgroundColor,
    agent: getComputedStyle(document.querySelector("[data-agent-workspace]")!).backgroundColor,
  }));
  expect(agentColors.agent).toBe(agentColors.workspace);
  expect(agentColors.workspace).toBe(dark.workspace);
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("[data-agent-pane]")).toHaveCount(0);
});
