import { expect, test } from "playwright/test";

test("Library shelf keeps real reader links and search recovery in the full page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/library");

  await expect(page.locator("[data-agent-pane]")).toHaveCount(0);
  const shelfButton = page.getByRole("button", { name: "Shelf view" });
  await shelfButton.click();
  await expect(shelfButton).toHaveAttribute("aria-pressed", "true");

  const documents = page.getByRole("list", { name: "Workspace documents" });
  await expect(documents.getByRole("link", { name: /Verto Feature Demo/ })).toHaveAttribute(
    "href",
    "/read/demo"
  );
  await expect(
    documents.getByRole("button", { name: "Bookmark: Verto Feature Demo" })
  ).toBeVisible();

  const search = page.getByRole("searchbox", { name: "Search documents" });
  await search.fill("missing document");
  await expect(page.getByRole("heading", { name: "No matching documents" })).toBeVisible();
  await page.getByRole("button", { name: "Clear document search" }).click();
  await expect(search).toHaveValue("");
  await expect(documents.getByRole("link", { name: /Verto Feature Demo/ })).toBeVisible();
});

test("Library shelf stays readable and bookmarkable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/library");
  await page.getByRole("button", { name: "Shelf view", exact: true }).click();
  const documents = page.getByRole("list", { name: "Workspace documents" });
  const article = documents.getByRole("link", { name: /Verto Feature Demo/ });
  await expect(article).toBeVisible();
  const bookmark = documents.getByRole("button", { name: "Bookmark: Verto Feature Demo" });
  await bookmark.click();
  await expect(
    documents.getByRole("button", { name: "Remove bookmark: Verto Feature Demo" })
  ).toHaveAttribute("aria-pressed", "true");
  const geometry = await documents.evaluate((element) => ({
    width: element.clientWidth,
    scroll: element.scrollWidth,
  }));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1);
  await page.screenshot({ path: ".impeccable/review/shelf-mobile.jpg", fullPage: true });
});
