import { expect, test, type Locator } from "playwright/test";

const WORKSPACE_LINKS = [
  ["Home", "/"],
  ["Recent", "/recent"],
  ["RSS Inbox", "/inbox"],
  ["Mail", "/mail"],
  ["New note", "/editor"],
  ["Library", "/library"],
  ["Notes", "/library?view=notes"],
  ["Knowledge Studio", "/studio"],
  ["Collections", "/collections"],
  ["Bookmarks", "/bookmarks"],
  ["Tags", "/tags"],
  ["Sources", "/integrations"],
] as const;

async function expectWorkspaceNavigation(nav: Locator, current: string) {
  await expect(nav.getByRole("link")).toHaveCount(WORKSPACE_LINKS.length);
  for (const [label, href] of WORKSPACE_LINKS) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
  }
  await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
  await expect(nav.getByRole("link", { name: current, exact: true })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(nav.locator('[aria-disabled="true"]')).toContainText("Tasks");
  await expect(nav.locator('[aria-disabled="true"]')).toContainText("Planned");
  await expect(nav.getByRole("link", { name: "Tasks" })).toHaveCount(0);
}

test.describe("Unified web sidebar", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("keeps one stable navigation across Mail, RSS Inbox, and Library", async ({ page }) => {
    await page.goto("/mail");
    const nav = page.getByRole("navigation", { name: "Workspace navigation" });
    const agent = page.locator("[data-agent-pane]");
    const draft = agent.getByRole("textbox", { name: "Message the agent" });
    await expect(agent).toBeVisible();
    await expect(draft).toBeVisible();
    await draft.evaluate((input: HTMLInputElement) => {
      input.value = "Keep this sidebar draft";
    });

    await expectWorkspaceNavigation(nav, "Mail");
    await nav.getByRole("link", { name: "RSS Inbox" }).click();
    await expect(page).toHaveURL(/\/inbox$/);
    await expectWorkspaceNavigation(nav, "RSS Inbox");
    await expect(draft).toHaveValue("Keep this sidebar draft");

    await nav.getByRole("link", { name: "Library", exact: true }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expectWorkspaceNavigation(nav, "Library");
    await expect(draft).toHaveValue("Keep this sidebar draft");

    await nav.getByRole("link", { name: "Notes", exact: true }).click();
    await expect(page).toHaveURL(/\/library\?view=notes$/);
    await expect(page.getByRole("tab", { name: "Notes" })).toHaveAttribute("data-state", "active");
    await expectWorkspaceNavigation(nav, "Notes");

    await nav.getByRole("link", { name: "Mail", exact: true }).click();
    await expect(page).toHaveURL(/\/mail$/);
    await expectWorkspaceNavigation(nav, "Mail");
    await expect(draft).toHaveValue("Keep this sidebar draft");
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

  test("keeps the Workspace controls and Library tree interactive", async ({ page }) => {
    await page.goto("/library");
    const sidebar = page.locator('[data-testid="workspace-shell"]');
    const nav = sidebar.getByRole("navigation", { name: "Workspace navigation" });
    const workspace = nav.getByRole("button", { name: "Workspace" });

    await expect(nav.getByRole("link", { name: "Notes" })).toBeVisible();
    await workspace.click();
    await expect(nav.getByRole("link", { name: "Library", exact: true })).toHaveCount(0);
    await workspace.click();

    await nav.getByRole("button", { name: "Collapse Library navigation" }).click();
    await expect(nav.getByRole("link", { name: "Notes" })).toHaveCount(0);
    await nav.getByRole("button", { name: "Expand Library navigation" }).click();
    await expect(nav.getByRole("link", { name: "Notes" })).toBeVisible();

    await sidebar.getByRole("button", { name: "Verto workspace menu" }).click();
    await expect(sidebar.getByRole("menuitem", { name: "Manage sources" })).toHaveAttribute(
      "href",
      "/integrations"
    );
    await sidebar.getByRole("button", { name: "Verto workspace menu" }).click();
    await sidebar.getByRole("button", { name: "Open command palette" }).click();
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
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
          rail: background('[data-testid="workspace-shell"] nav[aria-label="App navigation"]'),
          panel: background('[data-testid="workspace-shell-panel"]'),
          workspace: background("[data-work-surface]"),
          agent: background("[data-agent-pane]"),
          selected: background('[aria-label="Workspace navigation"] a[aria-current="page"]'),
        };
      });

    const light = await readColors();
    expect(light.panel).toBe(light.workspace);
    expect(light.agent).toBe(light.workspace);

    await page.getByTestId("ws-rail-theme").click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect.poll(async () => (await readColors()).selected).not.toBe(light.selected);

    const dark = await readColors();
    expect(dark.panel).toBe(dark.workspace);
    expect(dark.agent).toBe(dark.workspace);
    expect(dark.rail).not.toBe(light.rail);
    expect(dark.selected).not.toBe(light.selected);
  });
});
