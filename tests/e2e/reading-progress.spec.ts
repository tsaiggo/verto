import { expect, test } from "playwright/test";

const READING_STATE_KEY = "verto:reading-state";

interface StoredReading {
  href: string;
  progress: number;
  scrollTop: number;
}

async function storedReading(page: import("playwright/test").Page): Promise<StoredReading | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      byHref?: Record<string, StoredReading>;
      recent?: StoredReading[];
    };
    return (
      parsed.byHref?.["/read/demo"] ??
      parsed.recent?.find((entry) => entry.href === "/read/demo") ??
      null
    );
  }, READING_STATE_KEY);
}

function documentScroll(page: import("playwright/test").Page) {
  return page.locator("[data-page-scroll]").filter({ has: page.locator("[data-article]") });
}

test.describe("Desktop reading progress", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("saves progress, surfaces it on Home and Library, and restores the reader", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate((key) => window.localStorage.removeItem(key), READING_STATE_KEY);
    await page.goto("/read/demo");

    const reader = documentScroll(page);
    await expect(reader).toBeVisible();
    const requestedScrollTop = await reader.evaluate((element) => {
      const next = Math.min(500, element.scrollHeight - element.clientHeight);
      element.scrollTop = next;
      return next;
    });
    expect(requestedScrollTop).toBeGreaterThan(0);

    await expect.poll(async () => (await storedReading(page))?.progress ?? 0).toBeGreaterThan(0);
    await expect
      .poll(async () =>
        Math.abs(((await storedReading(page))?.scrollTop ?? 0) - requestedScrollTop)
      )
      .toBeLessThanOrEqual(1);

    const saved = await storedReading(page);
    expect(saved).not.toBeNull();
    const percentLabel = `${Math.round(saved!.progress)}%`;

    await page
      .locator("[data-shell-rail]")
      .getByRole("link", { name: "Verto", exact: true })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await expect
      .poll(async () => Math.abs(((await storedReading(page))?.scrollTop ?? 0) - saved!.scrollTop))
      .toBeLessThanOrEqual(1);
    const continueReading = page
      .locator(".home-continue")
      .filter({ hasText: "Verto Feature Demo" });
    await expect(continueReading).toContainText(percentLabel);
    expect(percentLabel).not.toBe("0%");

    await continueReading.click();
    await expect(page).toHaveURL(/\/read\/demo$/);
    await expect
      .poll(async () => {
        const restored = await page
          .locator("[data-page-scroll]")
          .filter({ has: page.locator("[data-article]") })
          .evaluate((element) => element.scrollTop);
        return Math.abs(restored - saved!.scrollTop);
      })
      .toBeLessThanOrEqual(1);

    await page.getByRole("button", { name: "Quick navigation" }).click();
    await page.getByRole("menuitem", { name: "Library", exact: true }).click();
    const documents = page.getByRole("list", { name: "Documents" });
    await expect(documents).toBeVisible();
    await expect(documents.getByRole("link", { name: /Verto Feature Demo/ })).toContainText(
      `reading ${Math.round(saved!.progress)}%`
    );
  });

  test("exposes each Library document as a native keyboard link", async ({ page }) => {
    await page.goto("/library");

    const documents = page.getByRole("list", { name: "Documents" });
    const documentLink = documents.getByRole("link", { name: /Verto Feature Demo/ });
    const bookmark = documents.getByRole("button", { name: /Bookmark: Verto Feature Demo/ });

    await expect(documentLink).toBeVisible();
    await documentLink.focus();
    await expect(documentLink).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(bookmark).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(documentLink).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/read\/demo$/);
  });
});
