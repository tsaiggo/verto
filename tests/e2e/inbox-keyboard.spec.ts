import { expect, test } from "playwright/test";

test("supports keyboard navigation across Inbox filters", async ({ page }) => {
  await page.goto("/inbox");

  const all = page.getByRole("tab", { name: /^All/ });
  const unread = page.getByRole("tab", { name: /^Unread/ });
  const archived = page.getByRole("tab", { name: /^Archived/ });

  await all.focus();
  await page.keyboard.press("ArrowRight");
  await expect(unread).toBeFocused();
  await expect(unread).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("End");
  await expect(archived).toBeFocused();
  await expect(archived).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "inbox-tab-archived");
});
