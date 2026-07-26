import { expect, test } from "playwright/test";

const route = "/final/41_editor-component-inserter";

test("shows the real Verto slash menu below the command line", async ({ page }) => {
  await page.goto(route);

  const trigger = page.getByText("/callout", { exact: true });
  const menu = page.getByRole("listbox", { name: "Insert a block" });
  await expect(trigger).toBeVisible();
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("option")).toHaveCount(3);
  await expect(menu.getByRole("option", { name: /Note/ })).toHaveAttribute("aria-selected", "true");

  const triggerBox = await trigger.boundingBox();
  const menuBox = await menu.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.y).toBeGreaterThanOrEqual(triggerBox!.y + triggerBox!.height + 4);
});

test.describe("mobile component inserter", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("uses a bottom tray and keeps the editor visible", async ({ page }) => {
    await page.goto(route);

    const trigger = page.getByText("/callout", { exact: true });
    const menu = page.getByRole("listbox", { name: "Insert a block" });
    await expect(trigger).toBeVisible();
    await expect(menu).toBeVisible();

    const menuBox = await menu.boundingBox();
    expect(menuBox).not.toBeNull();
    expect(Math.abs(menuBox!.x - 12)).toBeLessThanOrEqual(1);
    expect(Math.abs(menuBox!.width - 366)).toBeLessThanOrEqual(1);
    expect(Math.abs(844 - (menuBox!.y + menuBox!.height) - 12)).toBeLessThanOrEqual(1);

    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  });
});
