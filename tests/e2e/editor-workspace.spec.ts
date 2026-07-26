import { expect, test } from "playwright/test";

test.describe("Editor", () => {
  test("loads a document and previews its source", async ({ page }) => {
    await page.goto("/editor?slug=demo");

    const source = page.getByRole("combobox", { name: "MDX source" });
    await expect(source).toHaveValue(/# Verto Feature Demo/);
    await expect(page.getByRole("button", { name: "Source" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByRole("button", { name: "Preview" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(
      page.getByRole("heading", { name: "Verto Feature Demo", exact: true })
    ).toBeVisible();
    await expect(page.getByText('title: "Verto Feature Demo"', { exact: false })).not.toBeVisible();
  });

  test("renders MDX components in the preview", async ({ page }) => {
    await page.goto("/editor");

    await expect(page.getByRole("button", { name: "Toggle theme" })).toBeEnabled();
    const source = page.getByRole("combobox", { name: "MDX source" });
    await source.fill(`# Preview title

<Callout type="tip" />`);
    await expect(source).toHaveValue(`# Preview title

<Callout type="tip" />`);

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByRole("heading", { name: "Preview title", exact: true })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Tip");
    await expect(page.locator(".ed-preview-pane p .callout")).toHaveCount(0);
  });

  test("inserts an MDX block with slash, keeps native undo, and previews it", async ({ page }) => {
    await page.goto("/editor");
    const source = page.getByRole("combobox", { name: "MDX source" });
    await expect(source).toHaveValue("# Untitled\n\n");
    await source.click();
    await source.press("Control+a");
    await source.type("/callout");
    await expect(source).toHaveValue("/callout");

    const menu = page.getByRole("listbox", { name: "Insert a block" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("option")).toHaveCount(3);
    await expect(menu.getByRole("option", { name: /Note/ })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await source.press("Enter");
    await expect(source).toHaveValue('<Callout type="info">\n  Write a note.\n</Callout>');

    await source.press("Control+z");
    await expect(source).toHaveValue("/callout");

    await source.press("Control+y");
    await expect(source).toHaveValue('<Callout type="info">\n  Write a note.\n</Callout>');
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByRole("note")).toContainText("Write a note.");
  });

  test("inserts a bookmark with a working preview link", async ({ page }) => {
    await page.goto("/editor");
    const source = page.getByRole("combobox", { name: "MDX source" });
    await expect(source).toHaveValue("# Untitled\n\n");
    await source.click();
    await source.press("Control+a");
    await source.type("/bookmark");
    await expect(source).toHaveValue("/bookmark");
    await page.getByRole("option", { name: "Bookmark Give a link more context" }).click();

    await expect(source).toHaveValue(
      '<BookmarkCard\n  url="https://example.com"\n  title="Bookmark title"\n' +
        '  description="Why this link matters."\n/>'
    );
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByRole("link", { name: /Bookmark title/ })).toHaveAttribute(
      "href",
      "https://example.com"
    );
  });

  test("keeps .md files on the Markdown preview path", async ({ page }) => {
    await page.goto("/editor");
    await page.getByRole("textbox", { name: "Filename" }).fill("notes.md");
    const source = page.getByRole("combobox", { name: "MDX source" });
    await source.fill('# Markdown note\n\n<Callout type="tip">Plain HTML-like source.</Callout>');

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByRole("heading", { name: "Markdown note" })).toBeVisible();
    await expect(page.getByRole("note")).toHaveCount(0);
  });

  test("keeps the editor available when MDX cannot be previewed", async ({ page }) => {
    await page.goto("/editor");

    const source = page.getByRole("combobox", { name: "MDX source" });
    await source.fill(`# Broken preview

<Callout type="tip">`);

    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText("Preview unavailable", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Editor", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Source" })).toBeVisible();
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

    await expect(page.getByText("not found", { exact: false })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Filename" })).toHaveValue(
      "missing-document.mdx"
    );
    await expect(page.getByRole("combobox", { name: "MDX source" })).toHaveValue("# Untitled\n\n");
  });

  test("keeps an unsaved draft when browser Back is cancelled", async ({ page }) => {
    await page.goto("/library");
    await page
      .locator("[data-shell-rail]")
      .getByRole("link", { name: "New document", exact: true })
      .click();
    await expect(page).toHaveURL(/\/editor$/);

    const source = page.getByRole("combobox", { name: "MDX source" });
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
    const source = page.getByRole("combobox", { name: "MDX source" });
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
    expect(layout.filename!.width).toBeGreaterThanOrEqual(350);
  });

  test("keeps the slash command tray inside a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/editor");
    const source = page.getByRole("combobox", { name: "MDX source" });
    await expect(source).toBeEditable();
    await source.click();
    await source.press("Control+a");
    await source.type("/");
    await expect(source).toHaveValue("/");

    const menu = page.getByRole("listbox", { name: "Insert a block" });
    await expect(menu).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(source).toBeFocused();
    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const listbox = document.querySelector<HTMLElement>("[role='listbox']");
      const option = document.querySelector<HTMLElement>("[role='option']");
      return {
        clientWidth: root.clientWidth,
        scrollWidth: root.scrollWidth,
        menu: listbox?.getBoundingClientRect(),
        option: option?.getBoundingClientRect(),
      };
    });

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.menu).toBeDefined();
    expect(layout.menu!.left).toBeGreaterThanOrEqual(0);
    expect(layout.menu!.right).toBeLessThanOrEqual(layout.clientWidth);
    expect(layout.menu!.top).toBeGreaterThanOrEqual(0);
    expect(layout.menu!.bottom).toBeLessThanOrEqual(844);
    expect(layout.option!.height).toBeGreaterThanOrEqual(44);
  });

  test("shows a keyboard focus ring on the standalone source textarea", async ({ page }) => {
    await page.goto("/editor");
    const source = page.getByRole("combobox", { name: "MDX source" });
    const download = page.getByRole("button", { name: "Download .mdx" });
    await download.focus();
    await page.keyboard.press("Tab");

    await expect(source).toBeFocused();
    await expect
      .poll(() => source.evaluate((element) => getComputedStyle(element).outlineStyle))
      .toBe("solid");
  });

  test("keeps Agent edits scoped to the draft when no provider is configured", async ({ page }) => {
    await page.goto("/editor");

    const agent = page.getByRole("complementary", { name: "Edit with Agent" });
    await expect(agent).toBeVisible();
    await expect(
      agent.getByText(
        "The request and current draft are sent to your configured provider. Applying the suggestion changes only this draft; saving or downloading remains explicit."
      )
    ).toBeVisible();
    await expect(
      agent.getByText("Choose an AI provider in Settings", { exact: false })
    ).toBeVisible();
    await expect(agent.getByRole("link", { name: "Open AI & Agent settings" })).toHaveAttribute(
      "href",
      "/settings/agent"
    );

    await agent.getByRole("textbox", { name: "What should change?" }).fill("Tighten the opening.");
    await expect(agent.getByRole("button", { name: "Review suggestion" })).toBeDisabled();
    await expect(page.getByRole("combobox", { name: "MDX source" })).toHaveValue("# Untitled\n\n");
  });

  test("keeps the Agent editor controls inside a 390px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/editor");

    const agent = page.getByRole("complementary", { name: "Edit with Agent" });
    await agent.scrollIntoViewIfNeeded();
    const request = agent.getByRole("textbox", { name: "What should change?" });
    await expect(request).toBeVisible();

    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const aside = document.querySelector<HTMLElement>("aside[aria-labelledby]");
      const textarea = aside?.querySelector<HTMLTextAreaElement>("textarea");
      const review = Array.from(aside?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(
        (button) => button.textContent?.includes("Review suggestion")
      );
      return {
        clientWidth: root.clientWidth,
        scrollWidth: root.scrollWidth,
        aside: aside?.getBoundingClientRect(),
        textarea: textarea?.getBoundingClientRect(),
        review: review?.getBoundingClientRect(),
      };
    });

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.aside).toBeDefined();
    expect(layout.aside!.left).toBeGreaterThanOrEqual(0);
    expect(layout.aside!.right).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.textarea!.width).toBeGreaterThanOrEqual(340);
    expect(layout.review!.height).toBeGreaterThanOrEqual(44);
  });
});
