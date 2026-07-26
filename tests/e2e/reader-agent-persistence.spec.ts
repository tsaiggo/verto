import { expect, test } from "playwright/test";

const mockAssistantEnabled = process.env.NEXT_PUBLIC_VERTO_ASSISTANT === "mock";

test.describe("Reader Agent document threads", () => {
  test.skip(!mockAssistantEnabled, "Runs against the deterministic mock Agent provider.");
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/read/demo");
    await page.evaluate(() => window.localStorage.removeItem("verto:agent-threads"));
    await page.reload();
  });

  test("restores a successful exchange for the same document and clears it durably", async ({
    page,
  }) => {
    const panel = page.getByRole("complementary", { name: "Agent" });
    const question = "What is this document about?";

    await panel.getByRole("textbox", { name: "Your question" }).fill(question);
    await panel.getByRole("button", { name: "Send" }).click();
    await expect(panel.getByText("Verto is an MDX reader", { exact: false })).toBeVisible();

    const persisted = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("verto:agent-threads") ?? "{}")
    );
    expect(persisted.threads).toHaveLength(1);
    expect(persisted.threads[0]).toMatchObject({
      scope: {
        kind: "document",
        href: "/read/demo",
        slug: ["demo"],
      },
    });
    expect(persisted.threads[0].messages).toHaveLength(2);

    await page.reload();
    await expect(panel.getByText(question, { exact: true })).toBeVisible();
    await expect(panel.getByText("Verto is an MDX reader", { exact: false })).toBeVisible();

    await panel.getByRole("button", { name: "Clear conversation" }).click();
    await page.reload();
    await expect(panel.getByText(question, { exact: true })).toHaveCount(0);
    await expect(panel.getByText("Ask about this document")).toBeVisible();
  });
});
