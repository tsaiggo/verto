import { expect, test, type Locator } from "playwright/test";

const WORKSPACE_LINKS = [
  ["Home", "/"],
  ["RSS Inbox", "/inbox"],
  ["Mail", "/mail"],
  ["Recent", "/recent"],
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
    await expect(page.getByRole("heading", { name: "Connect your mail" })).toBeVisible();
  });
});
