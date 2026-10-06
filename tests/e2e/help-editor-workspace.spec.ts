import { expect, test } from "playwright/test";

test.describe("Help and Editor workspaces", () => {
  test.use({ viewport: { width: 1440, height: 800 } });

  test("keeps Help in the Reader frame without an Agent pane", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("verto:agent-pane:open", "1"));
    await page.goto("/help/writing/math");

    const helpDocument = page.locator("[data-reader-document]");
    await expect(helpDocument.getByRole("heading", { name: "Math (KaTeX)" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Document navigation" })).toBeHidden();
    await page.getByRole("button", { name: "Toggle document navigation" }).click();
    await expect(page.getByRole("complementary", { name: "Document navigation" })).toBeVisible();
    await expect(page.locator("[data-context-panel]")).toHaveCount(0);
    await expect(page.locator(".chat-col, [data-agent-slot], [data-agent-pane]")).toHaveCount(0);
    await expect(helpDocument.locator(".doc-tags a")).toHaveCount(0);
    await expect(helpDocument.locator(".doc-tags span")).toContainText(["math", "katex"]);

    const widths = await page.evaluate(() => ({
      document: window.document.querySelector("[data-reader-document]")?.getBoundingClientRect()
        .width,
      article: window.document.querySelector("[data-article]")?.getBoundingClientRect().width,
    }));
    expect(widths.document).toBeLessThanOrEqual(840);
    expect(widths.article).toBeLessThanOrEqual(840);
  });

  test("keeps document navigation beside the Editor without a duplicate route header", async ({
    page,
  }) => {
    await page.goto("/editor");

    await expect(page.getByRole("combobox", { name: "MDX source" })).toBeVisible();
    await expect(page.locator("[data-agent-pane], #editor-agent-panel")).toHaveCount(0);
    await expect(page.locator("#editor-ai-review")).toBeHidden();
    await expect(page.getByRole("button", { name: "Edit with AI" })).toBeVisible();
    await expect(page.locator(".ed-page > .pgh")).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Document navigation" })).toBeHidden();
    await page.getByRole("button", { name: "Toggle document navigation" }).click();
    await expect(page.getByRole("complementary", { name: "Document navigation" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Untitled", exact: true })).toBeVisible();

    const geometry = await page.evaluate(() => {
      const toolbar = document.querySelector<HTMLElement>("[data-article-editor-toolbar]")!;
      const navigation = document.querySelector<HTMLElement>("#editor-document-navigation")!;
      return {
        navigationWidth: navigation.getBoundingClientRect().width,
        toolbarBackground: getComputedStyle(toolbar).backgroundColor,
        surfaceBackground: getComputedStyle(document.querySelector<HTMLElement>(".ed-client-pane")!)
          .backgroundColor,
      };
    });
    expect(geometry.navigationWidth).toBe(272);
    expect(geometry.toolbarBackground).toBe(geometry.surfaceBackground);

    const toggle = page.getByRole("button", { name: "Toggle document navigation" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("complementary", { name: "Document navigation" })).toBeHidden();
    await expect(page.getByRole("combobox", { name: "MDX source" })).toBeVisible();
  });
});
