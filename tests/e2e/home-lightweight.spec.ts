import { expect, test } from "playwright/test";

test.describe("Home lightweight layout", () => {
  test("aligns the identity and workbench to one desktop frame", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const frame = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(".home-shell .pgh.is-entity");
      const workbench = document.querySelector<HTMLElement>(".home-workbench");
      const utilities = header?.querySelector<HTMLElement>(".pgh-right");

      if (!header || !workbench || !utilities) return null;

      const headerRect = header.getBoundingClientRect();
      const workbenchRect = workbench.getBoundingClientRect();
      const utilitiesRect = utilities.getBoundingClientRect();
      const headerScroll = header.closest<HTMLElement>("[data-page-scroll]");
      const workbenchScroll = workbench.closest<HTMLElement>("[data-page-scroll]");

      return {
        headerLeft: Math.round(headerRect.left),
        headerRight: Math.round(headerRect.right),
        workbenchLeft: Math.round(workbenchRect.left),
        workbenchRight: Math.round(workbenchRect.right),
        utilitiesRight: Math.round(utilitiesRect.right),
        sharedScroll: Boolean(headerScroll && headerScroll === workbenchScroll),
        scrollOverflowY: headerScroll ? getComputedStyle(headerScroll).overflowY : null,
      };
    });

    expect(frame).not.toBeNull();
    expect(frame!.sharedScroll).toBe(true);
    expect(frame!.scrollOverflowY).toBe("auto");
    expect(Math.abs(frame!.headerLeft - frame!.workbenchLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(frame!.headerRight - frame!.workbenchRight)).toBeLessThanOrEqual(1);
    expect(Math.abs(frame!.utilitiesRight - frame!.workbenchRight)).toBeLessThanOrEqual(1);
  });

  test("uses semantic sections without boxed mobile dashboard cards", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 2, name: /Continue Reading|Start Reading/ })
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Ask your library" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Recently Updated" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Library Sections" })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Ask your library" })).toHaveAttribute(
      "name",
      "prompt"
    );

    const geometry = await page.evaluate(() => {
      const cards = Array.from(
        document.querySelectorAll<HTMLElement>(
          ".home-feed > .home-card, .home-feed > .home-collections, .home-context"
        )
      );
      const pageScroll = document.querySelector<HTMLElement>("[data-page-scroll]");
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        pageScroll: pageScroll
          ? {
              clientHeight: pageScroll.clientHeight,
              scrollHeight: pageScroll.scrollHeight,
              overflowY: getComputedStyle(pageScroll).overflowY,
            }
          : null,
        cards: cards.map((card) => ({
          borderRadius: getComputedStyle(card).borderRadius,
          boxShadow: getComputedStyle(card).boxShadow,
        })),
      };
    });

    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.pageScroll).not.toBeNull();
    expect(geometry.pageScroll!.clientHeight).toBeGreaterThan(0);
    expect(geometry.pageScroll!.scrollHeight).toBeGreaterThan(geometry.pageScroll!.clientHeight);
    expect(geometry.pageScroll!.overflowY).toBe("auto");
    expect(geometry.cards.length).toBeGreaterThan(0);
    for (const card of geometry.cards) {
      expect(card.borderRadius).toBe("0px");
      expect(card.boxShadow).toBe("none");
    }
  });
});
