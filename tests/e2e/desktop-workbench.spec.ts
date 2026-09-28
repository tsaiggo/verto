import { expect, test } from "playwright/test";

const coreRoutes = ["/", "/library", "/read/demo"];

test.describe("Desktop workspace navigation", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("keeps primary destinations and utilities in the workspace sidebar", async ({ page }) => {
    await page.goto("/library");

    const rail = page.getByRole("navigation", { name: "App navigation" });
    const panel = page.getByTestId("workspace-unified-panel");
    await expect(rail.getByRole("link", { name: "Home", exact: true })).toHaveAttribute(
      "href",
      "/"
    );
    await expect(rail.getByRole("button", { name: "Search" })).toBeVisible();
    await expect(rail.getByRole("link", { name: "Library", exact: true })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(rail.getByRole("link", { name: "RSS Inbox" })).toHaveAttribute("href", "/inbox");
    await expect(rail.getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
    await expect(panel.getByRole("link", { name: "New note" })).toHaveAttribute("href", "/editor");
    await expect(panel.getByRole("button", { name: "Verto workspace menu" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Current location" })).toHaveText(
      "Local workspace/Library"
    );
  });

  test("supports a keyboard path through the skip link and primary destinations", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".vx-desktop-chrome")).toHaveCount(0);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    await page.goto("/");
    const rail = page.getByRole("navigation", { name: "App navigation" });
    await rail.getByTestId("workspace-shell-brand").focus();
    await page.keyboard.press("Tab");
    await expect(rail.getByRole("link", { name: "Home", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(rail.getByRole("button", { name: "Search" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(rail.getByRole("link", { name: "Recent" })).toBeFocused();
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
    const activePanel = page.getByRole("tabpanel");
    const panelId = await activePanel.getAttribute("id");
    const tabId = await all.getAttribute("id");
    expect(panelId).toBeTruthy();
    expect(tabId).toBeTruthy();
    await expect(all).toHaveAttribute("aria-controls", panelId!);
    await expect(activePanel).toHaveAttribute("aria-labelledby", tabId!);

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

  test("supports keyboard search scopes and hands the query to Agent", async ({ page }) => {
    await page.goto("/search");
    const scopes = page.getByRole("tablist", { name: "Result scope" });
    const all = scopes.getByRole("tab", { name: "All" });
    const pages = scopes.getByRole("tab", { name: "Pages" });
    const folders = scopes.getByRole("tab", { name: "Folders" });

    await all.focus();
    await page.keyboard.press("ArrowRight");
    await expect(pages).toBeFocused();
    await expect(pages).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(folders).toBeFocused();
    await page.keyboard.press("Home");
    await expect(all).toBeFocused();

    const prompt = "Compare the trust models";
    await page.getByRole("searchbox", { name: "Search your library" }).fill(prompt);
    await page.getByRole("link", { name: "Ask Agent" }).click();
    await expect(page).toHaveURL(/\/agent$/);
    await expect(page.getByRole("textbox", { name: "Message the agent" })).toHaveValue(prompt);
  });

  test("keeps document tabs keyboard accessible when multiple documents are open", async ({
    page,
  }) => {
    await page.goto("/read/demo");
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("verto:open-tabs")))
      .toContain('"/read/demo"');
    await expect(page.getByRole("tablist", { name: "Open documents" })).toHaveCount(0);

    await page.goto("/help/getting-started/introduction");
    const tablist = page.getByRole("tablist", { name: "Open documents" });
    await expect(tablist.getByRole("tab", { name: "Demo" })).toBeVisible();
    await page.goto("/read/demo");
    const demo = tablist.getByRole("tab", { name: "Demo" });
    await expect(demo).toHaveAttribute("aria-selected", "true");
    await demo.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/\/help\/getting-started\/introduction$/);
    const introduction = tablist.getByRole("tab", { name: "Introduction" });
    await expect(introduction).toBeFocused();
    await expect(introduction).toHaveAttribute("aria-selected", "true");

    await page.keyboard.press("Delete");
    await expect(page).toHaveURL(/\/read\/demo$/);
    await expect(page.getByRole("tablist", { name: "Open documents" })).toHaveCount(0);
  });

  test("preserves the shell through the Home, Library, Reader, and Library journey", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const host = window as Window & {
        __vertoShell?: { rail: Element | null; surface: Element | null };
      };
      host.__vertoShell = {
        rail: document.querySelector("[data-shell-rail]"),
        surface: document.querySelector("[data-work-surface]"),
      };
    });

    const rail = page.getByRole("navigation", { name: "App navigation" });
    await rail.getByRole("link", { name: "Library", exact: true }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByRole("heading", { name: "Library", level: 1 })).toBeVisible();
    await expect(rail.locator('a[aria-current="page"]')).toHaveCount(1);

    const documents = page.getByRole("list", { name: "Documents" });
    await documents.locator('a[href="/read/demo"]').click();
    await expect(page).toHaveURL(/\/read\/demo$/);
    await expect(page.getByRole("heading", { name: "Verto Feature Demo", level: 1 })).toBeVisible();
    await expect(page.locator(".vx-desktop-chrome")).toHaveCount(0);
    await expect(page.locator(".vx-topbar")).toBeVisible();
    await expect(rail.locator('a[aria-current="page"]')).toHaveCount(1);

    await rail.getByRole("link", { name: "Library", exact: true }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByRole("navigation", { name: "Current location" })).toHaveText(
      "Local workspace/Library"
    );
    await expect
      .poll(() =>
        page.evaluate(() => {
          const host = window as Window & {
            __vertoShell?: { rail: Element | null; surface: Element | null };
          };
          return (
            host.__vertoShell?.rail === document.querySelector("[data-shell-rail]") &&
            host.__vertoShell?.surface === document.querySelector("[data-work-surface]")
          );
        })
      )
      .toBe(true);
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
