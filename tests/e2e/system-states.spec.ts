import { expect, test } from "playwright/test";

test.describe("Application system states", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps an unknown local route useful, lightweight, and inside the viewport", async ({
    page,
  }) => {
    await page.goto("/route-that-does-not-exist");

    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse Library" })).toHaveAttribute(
      "href",
      "/library"
    );
    await expect(page.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/");

    const width = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
  });

  test("describes deletion ownership without pretending Verto has a cloud trash", async ({
    page,
  }) => {
    await page.goto("/trash");

    await expect(
      page.getByRole("heading", { name: "Trash stays with your file system" })
    ).toBeVisible();
    await expect(page.getByText("Verto never moves documents", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "View Sources" })).toHaveAttribute(
      "href",
      "/integrations"
    );
    await expect(page.getByText("not yet available", { exact: false })).toHaveCount(0);
  });
});
