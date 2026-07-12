import { expect, test } from "playwright/test";

test.describe("Sources", () => {
  test("distinguishes configured content from a user-selected local folder", async ({ page }) => {
    await page.goto("/integrations");

    await expect(page.getByText("Configured at build time", { exact: true })).toBeVisible();
    await expect(page.getByText("Configured content", { exact: true })).toBeVisible();

    const folder = page.getByRole("textbox", { name: "Folder" });
    await expect(folder).toHaveValue("");
    await expect(folder).toHaveAttribute("placeholder", "No folder chosen");
    await expect(page.getByRole("button", { name: "Save & connect" })).toBeDisabled();
    await expect(page.getByText("Feeds", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Last sync", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Storage", { exact: true })).toHaveCount(0);
  });
});
