import { expect, test } from "playwright/test";

test.describe("Editor", () => {
  test("loads a document and previews its source", async ({ page }) => {
    await page.goto("/editor?slug=demo");

    const source = page.getByRole("textbox", { name: "MDX source" });
    await expect(source).toHaveValue(/# Verto Feature Demo/);

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(
      page.getByRole("heading", { name: "Verto Feature Demo", exact: true })
    ).toBeVisible();
    await expect(page.getByText('title: "Verto Feature Demo"', { exact: false })).not.toBeVisible();
  });

  test("renders MDX components in the preview", async ({ page }) => {
    await page.goto("/editor");

    const source = page.getByRole("textbox", { name: "MDX source" });
    await source.fill(`# Preview title

<Callout type="tip" />`);

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByRole("heading", { name: "Preview title", exact: true })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Tip");
  });

  test("keeps the editor available when MDX cannot be previewed", async ({ page }) => {
    await page.goto("/editor");

    const source = page.getByRole("textbox", { name: "MDX source" });
    await source.fill(`# Broken preview

<Callout type="tip">`);

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText("Preview unavailable", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Editor", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Source" })).toBeVisible();
  });

  test("starts a new document when the requested file does not exist", async ({ page }) => {
    await page.goto("/editor?slug=missing-document");

    await expect(page.getByText("not found", { exact: false })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Filename" })).toHaveValue(
      "missing-document.mdx"
    );
    await expect(page.getByRole("textbox", { name: "MDX source" })).toHaveValue("# Untitled\n\n");
  });

  test("keeps the mobile editor toolbar readable without clipping its actions", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/editor");

    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const tabs = document.querySelector<HTMLElement>(".ed-client-tabs");
      const filename = document.querySelector<HTMLElement>(".ed-filename-input");
      const actions = document.querySelector<HTMLElement>(".ed-client-actions");
      const rect = (element: HTMLElement | null) => element?.getBoundingClientRect();

      return {
        rootClientWidth: root.clientWidth,
        rootScrollWidth: root.scrollWidth,
        tabs: rect(tabs),
        filename: rect(filename),
        actions: rect(actions),
      };
    });

    expect(layout.rootScrollWidth).toBeLessThanOrEqual(layout.rootClientWidth + 1);
    expect(layout.tabs).not.toBeNull();
    expect(layout.filename).not.toBeNull();
    expect(layout.actions).not.toBeNull();
    expect(layout.actions!.right).toBeLessThanOrEqual(layout.rootClientWidth + 1);
    expect(layout.filename!.top).toBeGreaterThan(layout.tabs!.bottom);
    expect(layout.filename!.width).toBeGreaterThanOrEqual(350);
  });
});
