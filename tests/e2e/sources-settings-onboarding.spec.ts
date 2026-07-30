import { expect, test } from "playwright/test";

test.describe("Local-first setup surfaces", () => {
  test("explains file ownership and exposes recovery states from Sources", async ({ page }) => {
    await page.goto("/integrations");

    await expect(page.getByRole("heading", { name: "Sources", exact: true })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "File ownership" })).toContainText(
      "Your files stay in their folder"
    );
    await expect(page.getByText(/choose a folder already synced by OneDrive/i)).toBeVisible();

    await page.goto("/integrations/permission-denied");
    await expect(
      page.getByRole("heading", { name: "Folder access needs to be restored" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Reconnect folder" })).toHaveAttribute(
      "href",
      "/integrations#local-files"
    );
  });

  test("keeps Files separate from optional AI settings", async ({ page }) => {
    await page.goto("/settings/files");

    await expect(page.getByRole("link", { name: "Files", exact: true })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(page.getByRole("heading", { name: "Files", exact: true })).toBeVisible();
    await expect(page.getByText("OneDrive, Dropbox, and network folders")).toBeVisible();
    await expect(page.getByText("Save coordination")).toBeVisible();
    await expect(page.getByText(/Windows also blocks active external writers/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "Manage folder" })).toHaveAttribute(
      "href",
      "/integrations#local-files"
    );

    await page.getByRole("link", { name: "AI & Agent" }).click();
    await expect(page).toHaveURL(/\/settings\/agent$/);
    await expect(page.getByRole("heading", { name: "AI & Agent", exact: true })).toBeVisible();
  });
});

test.describe("Local-first setup surfaces on mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps Sources, Settings, and indexing within the viewport", async ({ page }) => {
    for (const route of ["/integrations", "/settings/files", "/onboarding/indexing"]) {
      await page.goto(route);
      const width = await page.evaluate(() => ({
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
    }

    await expect(page.getByRole("link", { name: "Index files", exact: true })).toHaveAttribute(
      "aria-current",
      "step"
    );
  });
});
