import { expect, test } from "playwright/test";

test.describe("Collection handoff", () => {
  test("creates a collection from the reader and immediately adds the current document", async ({
    page,
  }) => {
    await page.goto("/read/demo");

    await page.getByRole("button", { name: "Add to collection" }).click();
    await page.getByRole("menuitem", { name: "Create and add to collection" }).click();

    await expect(
      page.getByRole("heading", { name: "Create collection and add this document" })
    ).toBeVisible();
    await page.getByRole("textbox", { name: "Collection name" }).fill("Project notes");
    await page.getByRole("button", { name: "Create and add" }).click();

    await expect(page.getByRole("button", { name: "In 1 collection" })).toBeVisible();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    await page.goto("/collections");
    await expect(page.getByRole("link", { name: /Project notes.*1 item/ })).toBeVisible();
  });
});
