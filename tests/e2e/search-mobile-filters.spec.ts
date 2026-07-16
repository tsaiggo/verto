import { expect, test } from "playwright/test";

test.describe("Mobile search filters", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps source filters available and applies them to results", async ({ page }) => {
    await page.goto("/search");

    const openFilters = page.getByRole("button", { name: "Open filters" });
    await expect(openFilters).toBeVisible();
    await openFilters.click();

    // Radix names the sheet from its visible DialogTitle ("Filters"). The
    // data hook scopes this assertion to the mobile sheet without coupling the
    // test to an obsolete aria-label that is superseded by aria-labelledby.
    const dialog = page.getByTestId("search-mobile-filter-sheet");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("role", "dialog");
    await expect(dialog).toHaveAccessibleName("Filters");
    await expect
      .poll(() =>
        dialog.evaluate((element) => element.getBoundingClientRect().bottom - window.innerHeight)
      )
      .toBeLessThanOrEqual(1);

    const dialogBounds = await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        top: bounds.top,
        bottom: bounds.bottom,
        height: bounds.height,
        viewportHeight: window.innerHeight,
      };
    });
    expect(dialogBounds.height).toBeGreaterThan(dialogBounds.viewportHeight * 0.4);
    expect(dialogBounds.height).toBeLessThan(dialogBounds.viewportHeight * 0.8);
    expect(dialogBounds.top).toBeGreaterThanOrEqual(0);
    expect(dialogBounds.bottom).toBeLessThanOrEqual(dialogBounds.viewportHeight + 1);

    const heading = dialog.getByRole("heading", { name: "Filters" });
    await expect(heading).toBeVisible();
    const headingTop = await heading.evaluate((element) => element.getBoundingClientRect().top);
    expect(headingTop).toBeGreaterThanOrEqual(dialogBounds.top);
    expect(headingTop - dialogBounds.top).toBeLessThan(80);

    const localSource = dialog.getByRole("checkbox", { name: /Local Library/ });
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
      const main = document.querySelector<HTMLElement>("[data-content-page] .content-body__main");
      const filters = document.querySelector<HTMLElement>(
        "[data-content-page] .content-body__aside"
      );
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
