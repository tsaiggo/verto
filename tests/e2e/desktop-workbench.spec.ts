import { expect, test } from "playwright/test";

const coreRoutes = ["/", "/library", "/read/demo"];

test.describe("Desktop workspace navigation", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("groups workspace destinations and keeps search in the rail", async ({ page }) => {
    await page.goto("/library");

    await expect(
      page.getByRole("navigation", { name: "Primary workspace navigation" })
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Projects" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Documents" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Workspace setup" })).toBeVisible();

    const search = page.getByRole("link", { name: "Search" });
    await expect(search).toHaveAttribute("href", "/search");
    await expect(
      page.locator("[data-shell-rail]").getByRole("link", { name: "New document", exact: true })
    ).toHaveAttribute("href", "/editor");
    const library = page
      .locator("[data-shell-rail]")
      .getByRole("link", { name: "Library", exact: true });
    await expect(library).toHaveAttribute("href", "/library");
    await expect(library).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Codex", exact: true })).toHaveAttribute(
      "href",
      "/"
    );
    await expect(page.getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
  });

  test("supports a keyboard path through the shell, skip link, and primary destinations", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    await page.goto("/");
    const rail = page.locator("[data-shell-rail]");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(rail.getByRole("link", { name: "Codex", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(rail.getByRole("link", { name: "Search" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(rail.getByRole("link", { name: "New document", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(rail.getByRole("link", { name: "Inbox", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    const library = rail.getByRole("link", { name: "Library", exact: true });
    await expect(library).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/library$/);
    await expect(library).toHaveAttribute("aria-current", "page");
  });
});

test.describe("Desktop tabs and route persistence", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("gives Library views one selected tab and complete arrow-key navigation", async ({
    page,
  }) => {
    await page.goto("/library");
    const tablist = page.getByRole("tablist", { name: "Library views" });
    const all = tablist.getByRole("tab", { name: /All Documents/ });
    const notes = tablist.getByRole("tab", { name: /Notes/ });
    const archives = tablist.getByRole("tab", { name: /Archives/ });

    await expect(all).toHaveAttribute("aria-selected", "true");
    await expect(all).toHaveAttribute("tabindex", "0");
    await expect(tablist.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
    await expect(page.getByRole("tabpanel")).toHaveAttribute("id", "library-documents");

    await all.focus();
    await page.keyboard.press("ArrowRight");
    await expect(notes).toBeFocused();
    await expect(notes).toHaveAttribute("aria-selected", "true");
    await expect(all).toHaveAttribute("tabindex", "-1");

    await page.keyboard.press("End");
    await expect(archives).toBeFocused();
    await expect(archives).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("Home");
    await expect(all).toBeFocused();
    await expect(all).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("list", { name: "Documents" })).toBeVisible();
  });

  test("keeps document tabs functional and returns home when the final tab closes", async ({
    page,
  }) => {
    await page.goto("/read/demo");
    const tab = page.getByRole("tab", { name: "Demo" });
    await expect(tab).toBeVisible();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await tab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(tab).toBeFocused();

    await page.getByRole("button", { name: "Close Demo" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("tablist", { name: "Open documents" })).toHaveCount(0);
  });

  test("preserves shell geometry through the Home, Library, Reader, and Library journey", async ({
    page,
  }) => {
    await page.goto("/");
    const initialGeometry = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>("[data-shell-root]");
      const rail = document.querySelector<HTMLElement>("[data-shell-rail]");
      const surface = document.querySelector<HTMLElement>("[data-work-surface]");
      if (!shell || !rail || !surface) throw new Error("Missing application shell");
      return {
        shellTop: Math.round(shell.getBoundingClientRect().top),
        railWidth: Math.round(rail.getBoundingClientRect().width),
        surfaceRadius: getComputedStyle(surface).borderTopLeftRadius,
      };
    });

    await page
      .locator("[data-shell-rail]")
      .getByRole("link", { name: "Library", exact: true })
      .click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByRole("heading", { name: "Library", level: 1 })).toBeVisible();
    await expect(page.locator('[data-shell-rail] a[aria-current="page"]')).toHaveCount(1);

    const documents = page.getByRole("list", { name: "Documents" });
    await documents.locator('a[href="/read/demo"]').click();
    await expect(page).toHaveURL(/\/read\/demo$/);
    await expect(page.getByRole("heading", { name: "Verto Feature Demo", level: 1 })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Demo" })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[data-shell-rail] a[aria-current="page"]')).toHaveCount(1);

    await page
      .locator("[data-shell-rail]")
      .getByRole("link", { name: "Library", exact: true })
      .click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(
      page.locator("[data-shell-rail]").getByRole("link", { name: "Library", exact: true })
    ).toHaveAttribute("aria-current", "page");
    const finalGeometry = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>("[data-shell-root]");
      const rail = document.querySelector<HTMLElement>("[data-shell-rail]");
      const surface = document.querySelector<HTMLElement>("[data-work-surface]");
      if (!shell || !rail || !surface) throw new Error("Missing application shell");
      return {
        shellTop: Math.round(shell.getBoundingClientRect().top),
        railWidth: Math.round(rail.getBoundingClientRect().width),
        surfaceRadius: getComputedStyle(surface).borderTopLeftRadius,
      };
    });
    expect(finalGeometry).toEqual(initialGeometry);
    expect(finalGeometry.shellTop).toBe(0);
    expect(finalGeometry.surfaceRadius).toBe("12px");
  });
});

test.describe("Desktop runtime health", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("does not emit uncaught or console errors across the core routes", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });

    for (const route of coreRoutes) {
      await page.goto(route);
      await expect(page.locator("#main-content")).toBeVisible();
    }

    expect(errors).toEqual([]);
  });
});
