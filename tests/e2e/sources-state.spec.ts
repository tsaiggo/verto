import { expect, test } from "playwright/test";

test.describe("Sources", () => {
  test("distinguishes configured content from a user-selected local folder", async ({ page }) => {
    await page.goto("/integrations");

    await expect(page.getByText("Configured at build time", { exact: true })).toBeVisible();
    await expect(page.getByText("Configured content", { exact: true })).toBeVisible();

    const folder = page.getByRole("textbox", { name: "Folder" });
    await expect(folder).toHaveValue("");
    await expect(folder).toHaveAttribute("placeholder", "No folder chosen");
  });
});
