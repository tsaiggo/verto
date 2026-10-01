import { expect, test } from "playwright/test";

test.describe("Help and Editor workspaces", () => {
  test.use({ viewport: { width: 1440, height: 800 } });

  test("keeps Help in the Reader frame without an Agent pane", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("verto:agent-pane:open", "1"));
    await page.goto("/help/writing/math");

    const helpDocument = page.locator("[data-reader-document]");
    await expect(helpDocument.getByRole("heading", { name: "Math (KaTeX)" })).toBeVisible();
    await expect(page.locator("[data-context-panel]")).toBeVisible();
    await expect(page.locator(".chat-col, [data-agent-slot], [data-agent-pane]")).toHaveCount(0);
    await expect(helpDocument.locator(".doc-tags a")).toHaveCount(0);
    await expect(helpDocument.locator(".doc-tags span")).toContainText(["math", "katex"]);

    const widths = await page.evaluate(() => ({
      document: window.document.querySelector("[data-reader-document]")?.getBoundingClientRect()
        .width,
      article: window.document.querySelector("[data-article]")?.getBoundingClientRect().width,
    }));
    expect(widths.document).toBeLessThanOrEqual(760);
    expect(widths.article).toBeLessThanOrEqual(760);
  });

  test("aligns the Editor header and toolbar to the same 32px gutter", async ({ page }) => {
    await page.goto("/editor");

    await expect(page.getByRole("combobox", { name: "MDX source" })).toBeVisible();
    await expect(page.locator("[data-agent-pane], #editor-agent-panel")).toHaveCount(0);
    await expect(page.locator("#editor-ai-review")).toBeHidden();
    await expect(page.getByRole("button", { name: "Edit with AI" })).toBeVisible();

    const geometry = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(".ed-page > .pgh")!;
      const toolbar = document.querySelector<HTMLElement>(".ed-client-bar")!;
      return {
        headerPadding: getComputedStyle(header).paddingLeft,
        toolbarPadding: getComputedStyle(toolbar).paddingLeft,
        toolbarBackground: getComputedStyle(toolbar).backgroundColor,
        surfaceBackground: getComputedStyle(document.querySelector<HTMLElement>(".ed-client-pane")!)
          .backgroundColor,
      };
    });
    expect(geometry.headerPadding).toBe("32px");
    expect(geometry.toolbarPadding).toBe("32px");
    expect(geometry.toolbarBackground).toBe(geometry.surfaceBackground);
  });
});
