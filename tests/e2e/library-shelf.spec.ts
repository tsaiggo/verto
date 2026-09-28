import { expect, test } from "playwright/test";

test("Library shelf keeps real reader links and search recovery beside Agent", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => window.localStorage.setItem("verto:agent-pane:open", "1"));
  await page.goto("/library");

  await expect(page.locator("[data-agent-pane]")).toBeVisible();
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
