import { expect, test } from "playwright/test";

test.describe("Sources", () => {
  test("distinguishes bundled build content from a user-selected local folder", async ({
    page,
  }) => {
    await page.goto("/integrations");

    await expect(page.getByRole("heading", { name: "Included demo", exact: true })).toBeVisible();
    await expect(page.getByText("Bundled content", { exact: true })).toBeVisible();

    // The header also exposes a folder picker shortcut. Scope the form
    // contract to the local-library connection region so strict locators do
    // not confuse the shortcut with the review-and-connect action.
    const localConnection = page.getByRole("region", { name: "Local library connection" });
    const folder = localConnection.getByRole("textbox", { name: "Folder" });
    await expect(folder).toHaveValue("");
    await expect(folder).toHaveAttribute("aria-readonly", "true");
    await expect(
      localConnection.getByRole("button", { name: /^Choose (folder|and connect)$/ })
    ).toBeVisible();
    await expect(localConnection.getByRole("button", { name: "Connect library" })).toBeDisabled();
    await expect(page.getByText("Feeds", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Last sync", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Storage", { exact: true })).toHaveCount(0);
  });
});
