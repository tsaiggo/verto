import { expect, test } from "playwright/test";

const assistantKind = (process.env.NEXT_PUBLIC_VERTO_ASSISTANT ?? "").trim().toLowerCase();
const assistantEnabled = ["github", "copilot", "github-models", "mock"].includes(assistantKind);

test.describe("Reader settings", () => {
  test("uses the reader's dark palette for preferences", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("theme", "dark"));
    await page.goto("/read/demo");

    const settings = page.getByRole("button", { name: "Reading settings" });
    await expect(settings).toBeEnabled();
    await settings.click();

    const popover = page.getByTestId("reading-settings-popover");
    await expect(popover).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(popover).toHaveCSS("background-color", "rgb(42, 42, 42)");
    await expect(popover).toHaveCSS("color", "rgb(236, 236, 236)");
  });
});

test.describe("Mobile reader overlays", () => {
  test.skip(!assistantEnabled, "Requires an enabled reading companion provider.");
  test.use({ viewport: { width: 390, height: 844 } });

  test("keeps settings, navigation, and the companion mutually exclusive", async ({ page }) => {
    await page.goto("/read/demo");

    const settingsTrigger = page.getByRole("button", { name: "Reading settings" });
    const settings = page.getByTestId("reading-settings-popover");
    const companionLauncher = page.getByRole("button", { name: "Open reading companion" });
    const companion = page.getByRole("dialog", { name: "Reading companion" });
    const navigationTrigger = page.getByRole("button", { name: "Open navigation" });
    const navigation = page.getByRole("dialog", { name: "Primary navigation" });

    await settingsTrigger.click();
    await expect(settings).toBeVisible();

    // The FAB intentionally disappears while settings is open. A contextual
    // Ask request must still hand off cleanly to the exclusive companion.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("verto:ask-ai")));
    await expect(settings).not.toBeVisible();
    await expect(companion).toBeVisible();
    await expect(navigationTrigger).toHaveCount(0);
    await expect
      .poll(() => companion.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);

    await page.keyboard.press("Escape");
    await expect(companion).not.toBeVisible();
    await expect(settingsTrigger).toBeFocused();

    await settingsTrigger.click();
    await expect(settings).toBeVisible();
    await navigationTrigger.click();
    await expect(settings).not.toBeVisible();
    await expect(navigation).toBeVisible();
    await expect(page.locator(".chat-col-fab")).toHaveCount(0);

    await navigation.getByRole("button", { name: "Close navigation" }).click();
    await expect(navigation).not.toBeVisible();
    await expect(companionLauncher).toBeVisible();

    await navigationTrigger.click();
    await expect(navigation).toBeVisible();

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("verto:ask-ai")));
    await expect(navigation).not.toBeVisible();
    await expect(companion).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(companion).not.toBeVisible();
    await expect(companionLauncher).toBeFocused();
  });
});

test.describe("Desktop reader companion", () => {
  test.skip(!assistantEnabled, "Requires an enabled reading companion provider.");
  test.use({ viewport: { width: 1280, height: 900 } });

  test("shares the non-modal Reader tools inspector with the TOC", async ({ page }) => {
    await page.goto("/read/demo");

    const readerTools = page.locator("[data-reader-tools]");
    const tocSurface = readerTools.locator("[data-reader-toc-surface]");
    const panelHost = readerTools.locator("[data-reading-companion-panel-host]");
    const launcher = readerTools
      .locator("[data-reading-companion-launcher-host]")
      .getByRole("button", { name: "Open reading companion" });
    await expect(launcher).toBeVisible();
    await launcher.click();

    const companion = panelHost.getByRole("region", { name: "Reading companion" });
    await expect(companion).toBeVisible();
    await expect(tocSurface).toBeHidden();
    await expect(page.getByRole("separator", { name: "Resize reading companion" })).toHaveCount(0);
    await expect(page.getByRole("dialog", { name: "Reading companion" })).toHaveCount(0);

    await page.getByRole("button", { name: "Reading settings" }).click();
    await expect(page.getByTestId("reading-settings-popover")).toBeVisible();
    await expect(companion).toBeVisible();
  });
});
