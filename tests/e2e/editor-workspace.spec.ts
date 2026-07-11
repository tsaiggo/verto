import { expect, test } from "playwright/test";

test.describe("Editor", () => {
  test("loads a document and previews its source", async ({ page }) => {
    await page.goto("/editor?slug=demo");

    const source = page.getByRole("textbox", { name: "MDX source" });
    await expect(source).toHaveValue(/# Verto Feature Demo/);

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(
      page.getByRole("heading", { name: "Verto Feature Demo", exact: true })
    ).toBeVisible();
    await expect(page.getByText('title: "Verto Feature Demo"', { exact: false })).not.toBeVisible();
  });

  test("starts a new document when the requested file does not exist", async ({ page }) => {
    await page.goto("/editor?slug=missing-document");

    await expect(page.getByText("not found", { exact: false })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Filename" })).toHaveValue(
      "missing-document.mdx"
    );
    await expect(page.getByRole("textbox", { name: "MDX source" })).toHaveValue("# Untitled\n\n");
  });
});
