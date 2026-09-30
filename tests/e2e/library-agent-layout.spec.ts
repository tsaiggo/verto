import { expect, test } from "playwright/test";

test("Library objects remain readable beside the Agent pane", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => window.localStorage.setItem("verto:agent-pane:open", "1"));
  await page.goto("/library");

  await expect(page.locator("[data-agent-pane]")).toBeVisible();
  const documents = page.getByRole("list", { name: "Documents" });
  await expect(documents).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search documents" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Shelf view", exact: true })).toBeVisible();

  const geometry = await documents.evaluate((element) => {
    const row = element.querySelector<HTMLElement>('[role="listitem"] a')!;
    const title = row.querySelector<HTMLElement>("strong")!;
    const metadata = row.querySelector<HTMLElement>("small")!;
    const updated = row.lastElementChild as HTMLElement;
    return {
      width: element.clientWidth,
      scroll: element.scrollWidth,
      title: title.getBoundingClientRect().toJSON(),
      metadata: metadata.getBoundingClientRect().toJSON(),
      updated: updated.getBoundingClientRect().toJSON(),
      row: row.getBoundingClientRect().toJSON(),
    };
  });
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1);
  expect(geometry.title.width).toBeGreaterThan(160);
  expect(geometry.metadata.top).toBeGreaterThanOrEqual(geometry.title.bottom - 1);
  expect(geometry.updated.left).toBeGreaterThan(geometry.title.right);
  expect(geometry.updated.right).toBeLessThanOrEqual(geometry.row.right);

  await page.setViewportSize({ width: 1800, height: 800 });
  const wide = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>(".lib-main")!;
    const source = document.querySelector<HTMLElement>("[data-context-panel]")!;
    return {
      main: main.getBoundingClientRect().toJSON(),
      source: source.getBoundingClientRect().toJSON(),
    };
  });
  expect(wide.source.top).toBeGreaterThanOrEqual(wide.main.bottom);
  expect(wide.source.left).toBeCloseTo(wide.main.left, 0);
});
