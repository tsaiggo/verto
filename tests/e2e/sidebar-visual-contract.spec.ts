import { expect, test } from "playwright/test";

test.describe("Desktop sidebar visual contract", () => {
  test.use({ colorScheme: "light", viewport: { width: 1280, height: 800 } });

  test("keeps the restrained reference proportions and palette", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#main-content")).toBeVisible();

    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const canvas = document.querySelector<HTMLElement>("[data-shell-root]")!;
      const rail = document.querySelector<HTMLElement>("[data-shell-rail]")!;
      const surface = document.querySelector<HTMLElement>("[data-work-surface]")!;
      const activeItem = document.querySelector<HTMLElement>(".vx-nav-item.is-active")!;
      const searchCommand = document.querySelector<HTMLElement>(".codex-rail-search")!;
      const searchRect = searchCommand.getBoundingClientRect();

      return {
        railWidth: rail.getBoundingClientRect().width,
        shellTop: canvas.getBoundingClientRect().top,
        canvasBackground: getComputedStyle(canvas).backgroundColor,
        railBackground: getComputedStyle(rail).backgroundColor,
        railClientWidth: rail.clientWidth,
        railScrollWidth: rail.scrollWidth,
        activeBackground: getComputedStyle(activeItem).backgroundColor,
        searchWidth: searchRect.width,
        searchHeight: searchRect.height,
        surfaceRadius: getComputedStyle(surface).borderTopLeftRadius,
        menuBarCount: document.querySelectorAll(".codex-menu-bar").length,
        rootClientWidth: root.clientWidth,
        rootScrollWidth: root.scrollWidth,
      };
    });

    expect(metrics.railWidth).toBeCloseTo(206, 0);
    expect(metrics.shellTop).toBeCloseTo(0, 0);
    expect(metrics.canvasBackground).toBe("rgb(255, 255, 255)");
    expect(metrics.railBackground).toBe("rgb(255, 255, 255)");
    expect(metrics.activeBackground).toBe("rgb(237, 237, 237)");
    expect(metrics.searchWidth).toBeCloseTo(24, 0);
    expect(metrics.searchHeight).toBeCloseTo(24, 0);
    expect(metrics.surfaceRadius).toBe("12px");
    expect(metrics.menuBarCount).toBe(0);
    expect(metrics.railScrollWidth).toBeLessThanOrEqual(metrics.railClientWidth + 1);
    expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.rootClientWidth + 1);
  });

  test("uses the Codex neutral hierarchy in dark mode", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);

    const palette = await page.evaluate(() => {
      const color = (selector: string, property: "backgroundColor" | "color") => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Missing dark palette element: ${selector}`);
        return getComputedStyle(element)[property];
      };

      return {
        railGradient: getComputedStyle(document.querySelector<HTMLElement>("[data-shell-rail]")!)
          .backgroundImage,
        surface: color("[data-work-surface]", "backgroundColor"),
        active: color(".vx-nav-item.is-active", "backgroundColor"),
        foreground: color("[data-shell-root]", "color"),
        surfaceRadius: getComputedStyle(document.querySelector<HTMLElement>("[data-work-surface]")!)
          .borderTopLeftRadius,
      };
    });

    expect(palette.railGradient).toContain("linear-gradient");
    expect(palette.railGradient).toContain("rgb(43, 41, 39)");
    expect(palette.railGradient).toContain("rgb(41, 39, 39)");
    expect(palette.surface).toBe("rgb(33, 33, 33)");
    expect(palette.active).toBe("rgb(48, 48, 48)");
    expect(palette.foreground).toBe("rgb(236, 236, 236)");
    expect(palette.surfaceRadius).toBe("12px");
  });
});
