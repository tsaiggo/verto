import { expect, test } from "playwright/test";

test.describe("Persistent web Agent pane", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("keeps one conversation mounted between pages and the expanded workspace", async ({
    page,
  }) => {
    let sourceRequests = 0;
    await page.route("**/agent-sources.json", (route) => {
      sourceRequests += 1;
      return route.continue();
    });
    await page.goto("/");
    const pane = page.locator("[data-agent-pane]");
    const draft = pane.getByRole("textbox", { name: "Message the agent" });
    await expect(pane).toBeVisible();
    await expect(draft).toBeVisible();

    // A DOM-only draft makes a remount observable even when no AI provider is configured.
    await draft.evaluate((input: HTMLInputElement) => {
      input.value = "Keep this draft";
    });
    await page.locator('[data-shell-rail] a[href="/library"]').first().click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(draft).toHaveValue("Keep this draft");

    await pane.getByRole("link", { name: "Expand Agent workspace" }).click();
    await expect(page).toHaveURL(/\/agent$/);
    await expect(draft).toHaveValue("Keep this draft");
    await expect(page.getByRole("main")).toHaveCount(1);
    expect(sourceRequests).toBe(1);
  });

  test("keeps route-specific Agents singular and restores the pane preference", async ({
    page,
  }) => {
    await page.goto("/");
    const pane = page.locator("[data-agent-pane]");
    await pane.getByRole("button", { name: "Collapse Agent pane" }).click();
    await expect(pane).toBeHidden();
    await expect(page.getByRole("button", { name: "Open Agent pane" })).toBeVisible();

    await page.reload();
    await expect(pane).toBeHidden();
    await page.getByRole("button", { name: "Open Agent pane" }).click();
    await expect(pane).toBeVisible();

    await page.goto("/read/demo");
    await expect(pane).toBeHidden();
    await expect(page.locator(".chat-col.is-open")).toBeVisible();

    await page.goto("/editor");
    await expect(pane).toBeHidden();
    await expect(page.getByRole("complementary", { name: "Edit with Agent" })).toBeVisible();
  });
});
