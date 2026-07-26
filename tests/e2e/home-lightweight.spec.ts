import { expect, test } from "playwright/test";

test.describe("Home lightweight layout", () => {
  test("uses semantic sections without boxed mobile dashboard cards", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 2, name: "Continue Reading" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Recently Updated" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Library Sections" })).toBeVisible();

    const geometry = await page.evaluate(() => {
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".home-feed > .home-card, .home-feed > .home-collections, .home-context"
        )
      );
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        cards: cards.map((card) => ({
          borderRadius: getComputedStyle(card).borderRadius,
          boxShadow: getComputedStyle(card).boxShadow,
        })),
      };
    });

    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.cards.length).toBeGreaterThan(0);
    for (const card of geometry.cards) {
      expect(card.borderRadius).toBe("0px");
      expect(card.boxShadow).toBe("none");
    }
  });
});
