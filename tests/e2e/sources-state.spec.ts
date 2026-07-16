import { expect, test } from "playwright/test";

test.describe("Sources", () => {
  test("distinguishes configured content from a user-selected local folder", async ({ page }) => {
    await page.goto("/integrations");

    await expect(page.getByText("Included in build", { exact: true })).toBeVisible();
    await expect(page.getByText("Configured content", { exact: true })).toBeVisible();

    const folder = page.getByRole("textbox", { name: "Folder" });
    await expect(folder).toHaveValue("");
    await expect(folder).toHaveAttribute("aria-readonly", "true");
    await expect(page.getByRole("button", { name: /^Choose (folder|and connect)$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect library" })).toBeDisabled();
    await expect(page.getByText("Feeds", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Last sync", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Storage", { exact: true })).toHaveCount(0);
  });
});
