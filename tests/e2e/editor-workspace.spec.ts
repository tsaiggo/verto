import { expect, test } from "playwright/test";

test.describe("Editor", () => {
  test("loads a document and previews its source", async ({ page }) => {
    await page.goto("/editor?slug=demo");

    const source = page.getByRole("textbox", { name: "MDX source" });
    await expect(source).toHaveValue(/# Verto Feature Demo/);
    await expect(page.getByRole("tab", { name: "Source" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.getByRole("tab", { name: "Preview" }).click();
    await expect(page.getByRole("tab", { name: "Preview" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(
      page.getByRole("heading", { name: "Verto Feature Demo", exact: true })
    ).toBeVisible();
    await expect(page.getByText('title: "Verto Feature Demo"', { exact: false })).not.toBeVisible();
  });

  test("renders MDX components in the preview", async ({ page }) => {
    await page.goto("/editor");

    await expect(page.locator(".vx-topbar")).toHaveAttribute("data-shortcuts-ready", "true");
    const source = page.getByRole("textbox", { name: "MDX source" });
    await expect(source).toBeVisible();
    await expect(source).toHaveValue("# Untitled\n\n");
    await source.fill(`# Preview title

<Callout type="tip" />`);
    await expect(source).toHaveValue(`# Preview title

<Callout type="tip" />`);

    await page.getByRole("tab", { name: "Preview" }).click();
    await expect(page.getByRole("heading", { name: "Preview title", exact: true })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Tip");
    await expect(page.locator(".ed-preview-pane p .callout")).toHaveCount(0);
  });

  test("keeps the editor available when MDX cannot be previewed", async ({ page }) => {
    await page.goto("/editor");

    const source = page.getByRole("textbox", { name: "MDX source" });
    await source.fill(`# Broken preview

<Callout type="tip">`);

    await page.getByRole("tab", { name: "Preview" }).click();
    await expect(page.getByText("Preview unavailable", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Editor", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Source" })).toBeVisible();
  });

  test("explains browser export and confirms the downloaded MDX filename", async ({ page }) => {
    await page.goto("/editor");

    await expect(page.getByText("Portable MDX draft", { exact: true })).toBeVisible();
    await expect(page.getByText("download a portable .mdx file", { exact: false })).toBeVisible();
    await page.getByRole("textbox", { name: "Filename" }).fill("project-notes.mdx");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download .mdx" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("project-notes.mdx");
    await expect(page.getByText("Downloaded project-notes.mdx", { exact: true })).toBeVisible();
  });

  test("starts a new document when the requested file does not exist", async ({ page }) => {
    await page.goto("/editor?slug=missing-document");

    await expect(
      page.locator(".content-status").getByText("The requested file was not found", { exact: true })
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Filename" })).toHaveValue(
      "missing-document.mdx"
    );
    await expect(page.getByRole("textbox", { name: "MDX source" })).toHaveValue("# Untitled\n\n");
  });

  test("keeps an unsaved draft when browser Back is cancelled", async ({ page }) => {
    await page.goto("/library");
    await page
      .locator("[data-page-identity]")
      .getByRole("link", { name: "New", exact: true })
      .click();
    await expect(page).toHaveURL(/\/editor$/);

    const source = page.getByRole("textbox", { name: "MDX source" });
    await expect(source).toHaveValue("# Untitled\n\n");
    await source.fill("# Unsaved browser history draft\n");

    const dialogPromise = page.waitForEvent("dialog");
    await page.evaluate(() => window.history.back());
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe("confirm");
    await dialog.dismiss();

    await expect(page).toHaveURL(/\/editor$/);
    await expect(source).toHaveValue("# Unsaved browser history draft\n");
  });

  test("cancels shortcut navigation until the draft exit is confirmed", async ({ page }) => {
    await page.goto("/editor?slug=demo");
    const source = page.getByRole("textbox", { name: "MDX source" });
    await expect(source).toHaveValue(/# Verto Feature Demo/);
    await source.fill("# Unsaved shortcut draft\n");

    const dialogPromise = page.waitForEvent("dialog");
    const shortcutPromise = page.keyboard.press("Control+k");
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe("confirm");
    await dialog.dismiss();
    await shortcutPromise;

    await expect(page).toHaveURL(/\/editor\?slug=demo$/);
    await expect(source).toHaveValue("# Unsaved shortcut draft\n");

    const confirmedDialogPromise = page.waitForEvent("dialog");
    const confirmedShortcutPromise = page.keyboard.press("Control+k");
    const confirmedDialog = await confirmedDialogPromise;
    await confirmedDialog.accept();
    await confirmedShortcutPromise;
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.getByRole("searchbox", { name: "Search your library" })).toBeVisible();
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
    expect(layout.filename!.width).toBeGreaterThanOrEqual(layout.rootClientWidth - 64);
  });
});
