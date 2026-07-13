import { expect, test } from "playwright/test";

test.describe.skip("Mobile search filters", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps source filters available and applies them to results", async ({ page }) => {
    await page.goto("/search");

    const openFilters = page.getByRole("button", { name: "Open filters" });
    await expect(openFilters).toBeVisible();
    await openFilters.click();

    const dialog = page.getByRole("dialog", { name: "Filters" });
    await expect(dialog).toBeVisible();
    const dialogHeight = await dialog.evaluate((element) => element.getBoundingClientRect().height);
    expect(dialogHeight).toBeGreaterThan(500);
    const heading = dialog.getByRole("heading", { name: "Filters" });
    await expect(heading).toBeVisible();
    await expect
      .poll(() => heading.evaluate((element) => element.getBoundingClientRect().top))
      .toBeLessThan(220);

    const localSource = dialog.getByRole("checkbox", { name: "Local Library 1" });
    await expect(localSource).toBeChecked();
    await localSource.uncheck();
    await dialog.getByRole("button", { name: "Close" }).click();

    await page.getByRole("searchbox", { name: "Search your library" }).fill("callout");
    await expect(page.getByText("No results for", { exact: false })).toBeVisible();
  });
});

test.describe("Search desktop layout", () => {
  test("keeps the filters rail beside the result column", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/search");

    const layout = await page.evaluate(() => {
      const main = document.querySelector<HTMLElement>(".search-main");
      const filters = document.querySelector<HTMLElement>(".search-page > .search-filters");
      return {
        main: main?.getBoundingClientRect(),
        filters: filters?.getBoundingClientRect(),
      };
    });

    expect(layout.main).not.toBeNull();
    expect(layout.filters).not.toBeNull();
    expect(layout.filters!.left).toBeGreaterThan(layout.main!.right);
  });
});
