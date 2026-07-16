import { expect, test } from "playwright/test";

const assistantKind = (process.env.NEXT_PUBLIC_VERTO_ASSISTANT ?? "").trim().toLowerCase();
const assistantEnabled = ["github", "copilot", "github-models", "mock"].includes(assistantKind);

test.describe("Desktop Reader tools inspector", () => {
  test.skip(!assistantEnabled, "Requires an enabled reading companion provider.");
  test.use({ viewport: { width: 1280, height: 800 } });

  test("preserves reader geometry, draft state, quote handoff, and focus", async ({ page }) => {
    await page.goto("/read/demo");

    const readerTools = page.locator("[data-reader-tools]");
    const tocSurface = readerTools.locator("[data-reader-toc-surface]");
    const launcherHost = readerTools.locator("[data-reading-companion-launcher-host]");
    const panelHost = readerTools.locator("[data-reading-companion-panel-host]");
    const launcher = launcherHost.getByRole("button", { name: "Open reading companion" });
    const main = page.locator(".reader-workbench > .main");
    const beforeOpen = await main.boundingBox();
    if (!beforeOpen) throw new Error("Reader main surface is not measurable");

    await expect(readerTools).toBeVisible();
    await expect(tocSurface.getByRole("navigation", { name: "Table of contents" })).toBeVisible();
    await expect(launcher).toBeVisible();
    await expect(
      page.locator(".docs-layout > .chat-col-fab, .docs-layout > .chat-col-dock")
    ).toHaveCount(0);

    await launcher.click();

    const companion = panelHost.getByRole("region", { name: "Reading companion" });
    await expect(companion).toBeVisible();
    const afterOpen = await main.boundingBox();
    if (!afterOpen) throw new Error("Reader main surface disappeared after opening companion");
    expect(Math.abs(afterOpen.x - beforeOpen.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(afterOpen.width - beforeOpen.width)).toBeLessThanOrEqual(1);
    await expect(tocSurface).toBeHidden();
    await expect(page.getByRole("dialog", { name: "Reading companion" })).toHaveCount(0);
    await expect
      .poll(() => companion.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
    const input = companion.getByRole("textbox", { name: "Your question" });
    await input.fill("Keep this draft while I check the contents.");

    await page.keyboard.press("Escape");
    await expect(companion).toBeHidden();
    await expect(tocSurface.getByRole("navigation", { name: "Table of contents" })).toBeVisible();
    await expect(
      launcherHost.getByRole("button", { name: "Open reading companion" })
    ).toBeFocused();

    const restoredLauncher = launcherHost.getByRole("button", {
      name: "Open reading companion",
    });
    await restoredLauncher.click();
    await expect(input).toHaveValue("Keep this draft while I check the contents.");
    await companion.getByRole("button", { name: "Back to contents" }).click();
    await expect(companion).toBeHidden();
    await expect(restoredLauncher).toBeFocused();

    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("verto:ask-ai", {
          detail: { quote: "Quoted passage survives the TOC switch." },
        })
      );
    });
    await expect(companion).toBeVisible();
    await expect(input).toHaveValue(/Quoted passage survives the TOC switch/);
    await page.keyboard.press("Escape");
    await expect(companion).toBeHidden();
  });

  test("restores an open desktop inspector without stealing focus", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("verto:chat-open", "1"));
    await page.goto("/read/demo");

    const companion = page
      .locator("[data-reading-companion-panel-host]")
      .getByRole("region", { name: "Reading companion" });
    await expect(companion).toBeVisible();
    await expect
      .poll(() => companion.evaluate((element) => element.contains(document.activeElement)))
      .toBe(false);
  });

  test("rebinds when Reader tools hosts are replaced without a route change", async ({ page }) => {
    await page.goto("/read/demo");

    const readerTools = page.locator("[data-reader-tools]");
    await expect(
      readerTools
        .locator("[data-reading-companion-launcher-host]")
        .getByRole("button", { name: "Open reading companion" })
    ).toBeVisible();

    await readerTools.evaluate((element) => {
      const replacement = element.cloneNode(true) as HTMLElement;
      replacement
        .querySelectorAll(
          "[data-reading-companion-launcher-host], [data-reading-companion-panel-host]"
        )
        .forEach((host) => host.replaceChildren());
      element.replaceWith(replacement);
    });

    const reboundTools = page.locator("[data-reader-tools]");
    const launcher = reboundTools
      .locator("[data-reading-companion-launcher-host]")
      .getByRole("button", { name: "Open reading companion" });
    await expect(launcher).toBeVisible();
    await launcher.click();
    await expect(
      reboundTools
        .locator("[data-reading-companion-panel-host]")
        .getByRole("region", { name: "Reading companion" })
    ).toBeVisible();
  });
});

test.describe("Reader tools below the desktop inspector breakpoint", () => {
  test.skip(!assistantEnabled, "Requires an enabled reading companion provider.");
  test.use({ viewport: { width: 1199, height: 800 } });

  test("keeps the companion in a modal launched from the floating action", async ({ page }) => {
    await page.goto("/read/demo");

    const launcher = page.locator(".chat-col-fab");
    await expect(launcher).toBeVisible();
    await expect(
      page.locator("[data-reading-companion-launcher-host]").getByRole("button")
    ).toHaveCount(0);

    await launcher.click();

    const companion = page.getByRole("dialog", { name: "Reading companion" });
    await expect(companion).toBeVisible();
    await expect(
      page
        .locator("[data-reading-companion-panel-host]")
        .getByRole("region", { name: "Reading companion" })
    ).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(companion).not.toBeVisible();
    await expect(launcher).toBeFocused();
  });
});
