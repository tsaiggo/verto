import { expect, test } from "playwright/test";

test("opens the current Reader document in the Editor", async ({ page }) => {
  await page.goto("/read/demo");
  await expect(
    page.locator("[data-reader-document] article, [data-reader-document] .prose").first()
  ).toBeVisible();

  const editLink = page.getByRole("link", { name: "Edit Verto Feature Demo" });
  await expect(editLink).toHaveAttribute("href", "/editor?slug=demo");
  await editLink.click();

  await expect(page).toHaveURL(/\/editor\?slug=demo$/);
  await expect(page.getByRole("combobox", { name: "MDX source" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "MDX source" })).toHaveValue(
    /Verto Feature Demo/
  );
});
