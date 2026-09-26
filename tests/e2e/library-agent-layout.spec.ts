import { expect, test } from "playwright/test";

test("Library document columns remain readable beside the Agent pane", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => window.localStorage.setItem("verto:agent-pane:open", "1"));
  await page.goto("/library");

  await expect(page.locator("[data-agent-pane]")).toBeVisible();
  const table = page.getByRole("list", { name: "Documents" });
  await expect(table).toBeVisible();

  const narrow = await table.evaluate((element) => {
    const header = element.firstElementChild as HTMLElement;
    const columns = Array.from(header.children, (child) =>
      (child as HTMLElement).getBoundingClientRect()
    );
    return {
      tableWidth: element.clientWidth,
      tableScrollWidth: element.scrollWidth,
      titleWidth: columns[0].width,
      titleRight: columns[0].right,
      sourceLeft: columns[1].left,
      sourceRight: columns[1].right,
      updatedLeft: columns[2].left,
      updatedRight: columns[2].right,
      headerRight: header.getBoundingClientRect().right,
    };
  });

  expect(narrow.tableScrollWidth).toBeLessThanOrEqual(narrow.tableWidth + 1);
  expect(narrow.titleWidth).toBeGreaterThan(100);
  expect(narrow.sourceLeft).toBeGreaterThanOrEqual(narrow.titleRight + 12);
  expect(narrow.updatedLeft).toBeGreaterThanOrEqual(narrow.sourceRight + 12);
  expect(narrow.updatedRight).toBeLessThanOrEqual(narrow.headerRight);

  await page.setViewportSize({ width: 1800, height: 800 });
  const wide = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>(".lib-main")!;
    const context = document.querySelector<HTMLElement>("[data-context-panel]")!;
    return {
      main: main.getBoundingClientRect().toJSON(),
      context: context.getBoundingClientRect().toJSON(),
    };
  });

  expect(wide.context.left).toBeGreaterThan(wide.main.right);
  expect(wide.context.top).toBeCloseTo(wide.main.top, 0);
});
