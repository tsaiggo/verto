import { expect, test } from "playwright/test";

test.describe("Agent workspace", () => {
  test("shows a clear next step when the assistant has not been configured", async ({ page }) => {
    await page.goto("/agent");

    const composer = page.getByRole("textbox", { name: "Message the agent" });
    await expect(composer).toBeEnabled();
    await composer.fill("Summarize my library");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(
      page.getByText("The AI assistant is not configured. Set NEXT_PUBLIC_VERTO_ASSISTANT=mock", {
        exact: false,
      })
    ).toBeVisible();

    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Library" })
      .click();
    await expect(page).toHaveURL(/\/library$/);
    await page
      .getByRole("navigation", { name: "Tools" })
      .getByRole("link", { name: "Agent" })
      .click();
    await expect(page).toHaveURL(/\/agent$/);
    await expect(composer).toBeEnabled();
  });
});
