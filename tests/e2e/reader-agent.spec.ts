import { expect, test } from "playwright/test";

for (const width of [390, 1280, 1440]) {
  test.describe(`${width}px Reader AI actions`, () => {
    test.use({ viewport: { width, height: 844 } });

    test("keeps reading free of Agent panes even with saved open preferences", async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem("verto:chat-open", "1");
        window.localStorage.setItem("verto:agent-pane:open", "1");
      });
      await page.goto("/read/demo");

      await expect(page.locator("[data-article]")).toBeVisible();
      await expect(page.locator(".chat-col, [data-agent-slot], [data-agent-pane]")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Open Agent" })).toHaveCount(0);
      await expect(page.getByRole("dialog", { name: "Agent", exact: true })).toHaveCount(0);

      const overflow = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });

    test("carries a selected passage and its document into the Agent workspace", async ({
      page,
    }) => {
      await page.goto("/read/demo");
      await expect(page.locator("[data-article]")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Reading settings", exact: true })
      ).toBeEnabled();
      const paragraph = page.locator("[data-article] p").first();
      await paragraph.scrollIntoViewIfNeeded();
      const quote = await paragraph.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
        return selection?.toString().trim() ?? "";
      });
      expect(quote.length).toBeGreaterThan(3);
      const selectionActions = page.getByRole("toolbar", { name: "Selection actions" });
      await expect(selectionActions).toBeVisible();
      const ask = selectionActions.getByRole("button", { name: "Ask AI about this" });
      if (await ask.count()) {
        await ask.click();
      } else {
        // Builds without a provider hide Ask; the mounted selection toolbar is
        // the readiness gate before exercising its shared handoff event.
        await page.evaluate((passage) => {
          window.dispatchEvent(new CustomEvent("verto:ask-ai", { detail: { quote: passage } }));
        }, quote);
      }

      await expect(page).toHaveURL(/\/agent\?/);
      const destination = new URL(page.url());
      expect(destination.searchParams.get("document")).toBe("/read/demo");
      const clipped = quote.length > 280 ? `${quote.slice(0, 280)}…` : quote;
      await expect(page.getByRole("textbox", { name: "Message the agent" })).toHaveValue(
        `About this passage: "${clipped}"\n\n`
      );
      await expect(page.locator("[data-agent-message]")).toHaveCount(0);
    });
  });
}
