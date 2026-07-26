import { expect, test } from "playwright/test";

test.describe("Agent workspace", () => {
  test("shows a clear next step when the AI provider has not been configured", async ({ page }) => {
    await page.goto("/agent");

    const composer = page.getByRole("textbox", { name: "Message the agent" });
    await expect(composer).toBeDisabled();
    await expect(page.getByRole("button", { name: "Send" })).toBeDisabled();
    await expect(
      page.getByText("AI is not enabled in this version of Verto", { exact: false })
    ).toBeVisible();
    const settings = page.getByRole("link", { name: "Open AI & Agent settings" });
    await expect(settings).toBeVisible();
    const library = page.getByRole("link", { name: "Browse Local library" });
    await expect(library).toHaveAttribute("href", "/library");
    await settings.click();
    await expect(page).toHaveURL(/\/settings\/agent$/);
    const setupStatus = page.getByRole("status");
    await expect(setupStatus).toContainText("No AI provider is included in this build");
    await expect(setupStatus).toContainText(
      "Reading, search, and editing still work locally. AI can be added later without moving your files or uploading the library to Verto."
    );

    await page
      .getByRole("complementary", { name: "Primary navigation" })
      .getByRole("link", { name: "Library" })
      .click();
    await expect(page).toHaveURL(/\/library$/);
    await page
      .getByRole("complementary", { name: "Primary navigation" })
      .getByRole("link", { name: "Agent" })
      .click();
    await expect(page).toHaveURL(/\/agent$/);
    await expect(composer).toBeDisabled();

    await page.getByRole("link", { name: "Browse Local library" }).click();
    await expect(page).toHaveURL(/\/library$/);
  });

  test("keeps Reader conversations visibly scoped to their source page", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "verto:agent-threads",
        JSON.stringify({
          threads: [
            {
              id: "reader-thread",
              title: "Reader question",
              scope: {
                kind: "document",
                href: "/read/demo",
                slug: ["demo"],
                title: "Verto Feature Demo",
              },
              messages: [
                { id: "user", role: "user", text: "What is this page about?" },
                { id: "agent", role: "agent", text: "It demonstrates Verto’s MDX blocks." },
              ],
              createdAt: "2026-07-26T09:00:00.000Z",
              updatedAt: "2026-07-26T09:01:00.000Z",
            },
          ],
        })
      );
    });

    await page.goto("/agent");
    const conversation = page.getByRole("button", { name: "Reader question", exact: true });
    await expect(conversation).toBeVisible();
    await expect(conversation.locator(".ag-history-item-scope")).toHaveText(
      "Page · Verto Feature Demo"
    );
    await expect(page.getByRole("link", { name: "Open Verto Feature Demo" })).toHaveAttribute(
      "href",
      "/read/demo"
    );
    await expect(page.getByText("It demonstrates Verto’s MDX blocks.")).toBeVisible();
  });
});

test.describe("Agent workspace on mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps conversation controls and setup guidance available", async ({ page }) => {
    await page.goto("/agent");

    const history = page.locator(".ag-history");
    await expect(history).toBeVisible();
    await expect(history).toHaveCSS("display", "flex");
    await expect(history.getByRole("button", { name: "New Chat" }).first()).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Message the agent" })).toBeDisabled();
    await expect(page.getByRole("link", { name: "Open AI & Agent settings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse Local library" })).toBeVisible();

    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      return { clientWidth: root.clientWidth, scrollWidth: root.scrollWidth };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });
});
