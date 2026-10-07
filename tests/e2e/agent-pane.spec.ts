import { expect, test } from "playwright/test";

test.describe("Standalone web Agent", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("loads Agent only when opened and restores saved conversation after page navigation", async ({
    page,
  }) => {
    let sourceRequests = 0;
    await page.route("**/agent-sources.json", (route) => {
      sourceRequests += 1;
      return route.continue();
    });
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "verto:agent-threads",
        JSON.stringify({
          threads: [
            {
              id: "workspace-thread",
              title: "Saved workspace conversation",
              scope: { kind: "workspace" },
              messages: [
                { id: "user", role: "user", text: "What can I read next?" },
                { id: "agent", role: "agent", text: "Start with the Verto Feature Demo." },
              ],
              createdAt: "2026-07-26T09:00:00.000Z",
              updatedAt: "2026-07-26T09:01:00.000Z",
            },
          ],
        })
      );
    });
    await page.goto("/");
    await expect(page.locator("[data-agent-pane]")).toHaveCount(0);
    await expect(page.locator("[data-agent-workspace]")).toHaveCount(0);
    const navigation = page.getByRole("navigation", { name: "Workspace navigation" });
    await navigation.getByRole("link", { name: "Library", exact: true }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByRole("list", { name: "Documents" })).toBeVisible();
    expect(sourceRequests).toBe(0);

    await navigation.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.locator(".home-agent-entry").click();
    await expect(page).toHaveURL(/\/agent$/);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("main", { name: "Agent" })).toHaveAttribute("id", "main-content");
    await expect(page.locator("[data-agent-pane]")).toHaveCount(0);
    await expect(page.locator("[data-agent-workspace]")).toHaveCount(1);
    await expect(page.getByText("What can I read next?", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Start with the Verto Feature Demo.", { exact: true })
    ).toBeVisible();
    expect(sourceRequests).toBe(1);

    await navigation.getByRole("link", { name: "Library", exact: true }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.locator("[data-agent-workspace]")).toHaveCount(0);
    await page.getByRole("button", { name: "Product actions" }).click();
    await page.getByRole("menuitem", { name: "Agent", exact: true }).click();
    await expect(page).toHaveURL(/\/agent$/);
    await expect(
      page.getByText("Start with the Verto Feature Demo.", { exact: true })
    ).toBeVisible();
    await page.getByRole("button", { name: "Conversation history", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Saved workspace conversation", exact: true })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("main")).toHaveCount(1);
  });

  test("ignores the retired pane preference on application pages", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("verto:agent-pane:open", "1"));
    for (const route of ["/", "/library", "/mail", "/inbox", "/read/demo", "/editor", "/help"]) {
      await page.goto(route);
      await expect(page.locator("#main-content")).toBeVisible();
      await expect(page.locator("[data-agent-pane]")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Open Agent pane" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Collapse Agent pane" })).toHaveCount(0);
      await expect(page.locator("[data-agent-workspace]")).toHaveCount(0);
    }
  });
});
