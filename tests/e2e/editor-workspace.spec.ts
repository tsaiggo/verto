import { expect, test } from "playwright/test";

test.describe("Editor", () => {
  test("loads a document and previews its source", async ({ page }) => {
    await page.goto("/editor?slug=demo");

    await expect(page.getByRole("navigation", { name: "Current location" })).toHaveText(
      "Local workspace/Editor"
    );
    const source = page.getByRole("combobox", { name: "MDX source" });
    await expect(source).toHaveValue(/# Verto Feature Demo/);
    await expect(page.getByRole("button", { name: "Source", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.getByRole("button", { name: "Preview", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(
      page.getByRole("heading", { name: "Verto Feature Demo", exact: true })
    ).toBeVisible();
    await expect(page.getByText('title: "Verto Feature Demo"', { exact: false })).not.toBeVisible();
    const previewType = await page.locator("[data-editor-preview]").evaluate((article) => ({
      title: Number.parseFloat(getComputedStyle(article.querySelector("h1")!).fontSize),
      body: Number.parseFloat(getComputedStyle(article.querySelector("p")!).fontSize),
    }));
    expect(previewType.title).toBeGreaterThan(previewType.body);
  });

  test("renders MDX components in the preview", async ({ page }) => {
    await page.goto("/editor");

    await expect(page.getByRole("button", { name: "Toggle theme" })).toBeEnabled();
    const source = page.getByRole("combobox", { name: "MDX source" });
    await source.fill(`# Preview title

<Callout type="tip" />`);
    await expect(source).toHaveValue(`# Preview title

<Callout type="tip" />`);

    await page.getByRole("button", { name: "Preview", exact: true }).click();
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
    await page.getByRole("button", { name: "Preview", exact: true }).click();
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
    await page.getByRole("button", { name: "Preview", exact: true }).click();
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

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Markdown note" })).toBeVisible();
    await expect(page.getByRole("note")).toHaveCount(0);
  });

  test("keeps the editor available when MDX cannot be previewed", async ({ page }) => {
    await page.goto("/editor");

    const source = page.getByRole("combobox", { name: "MDX source" });
    await source.fill(`# Broken preview

<Callout type="tip">`);

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(page.getByText("Preview unavailable", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Editor", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Source", exact: true })).toBeVisible();
  });

  test("shows compact browser export context and confirms the downloaded filename", async ({
    page,
  }) => {
    await page.goto("/editor");

    await expect(page.getByText("This browser", { exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "Filename" }).fill("project-notes.mdx");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("project-notes.mdx");
  });

  test("offers recovery when the requested source does not exist", async ({ page }) => {
    await page.goto("/editor?slug=missing-document");

    await expect(page.getByText("not found", { exact: false })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "MDX source" })).toHaveValue("# Untitled\n\n");
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  });

  test("keeps an unsaved draft when browser Back is cancelled", async ({ page }) => {
    await page.goto("/library");
    await page
      .getByRole("navigation", { name: "Workspace navigation" })
      .getByRole("link", { name: "New note", exact: true })
      .click();
    await expect(page).toHaveURL(/\/editor(?:\?document=.+)?$/);

    const source = page.getByRole("combobox", { name: "MDX source" });
    await expect(source).toHaveValue("# Untitled\n\n");
    await source.fill("# Unsaved browser history draft\n");

    const dialogPromise = page.waitForEvent("dialog");
    await page.evaluate(() => window.history.back());
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe("confirm");
    await dialog.dismiss();

    await expect(page).toHaveURL(/\/editor(?:\?document=.+)?$/);
    await expect(source).toHaveValue("# Unsaved browser history draft\n");
  });

  test("keeps a dirty draft when the global command shortcut is ignored", async ({ page }) => {
    await page.goto("/editor?slug=demo");
    const source = page.getByRole("combobox", { name: "MDX source" });
    await expect(source).toHaveValue(/# Verto Feature Demo/);
    await source.fill("# Unsaved shortcut draft\n");

    await page.keyboard.press("Control+k");
    await expect(page).toHaveURL(/\/editor\?(?:slug=demo|document=.+)$/);
    await expect(source).toHaveValue("# Unsaved shortcut draft\n");
    await expect(page.getByRole("dialog", { name: "Command palette" })).not.toBeVisible();
  });

  test("keeps the mobile editor toolbar readable without clipping its actions", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/editor");
    await expect(page.getByRole("textbox", { name: "Filename" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "MDX source" })).toBeEditable();

    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const tabs = document.querySelector<HTMLElement>('[aria-label="Document view"]');
      const filename = document.querySelector<HTMLElement>('[aria-label="Filename"]');
      const actions = filename?.parentElement?.parentElement;
      const buttons = Array.from(
        document.querySelectorAll<HTMLElement>('[aria-label="Document view"] button')
      ).map((button) => button.getBoundingClientRect());
      const rect = (element: HTMLElement | null | undefined) => element?.getBoundingClientRect();

      return {
        rootClientWidth: root.clientWidth,
        rootScrollWidth: root.scrollWidth,
        tabs: rect(tabs),
        filename: rect(filename),
        actions: rect(actions),
        buttons,
      };
    });

    expect(layout.rootScrollWidth).toBeLessThanOrEqual(layout.rootClientWidth + 1);
    expect(layout.tabs).not.toBeNull();
    expect(layout.filename).not.toBeNull();
    expect(layout.actions).not.toBeNull();
    expect(layout.actions!.right).toBeLessThanOrEqual(layout.rootClientWidth + 1);
    expect(layout.filename!.width).toBeGreaterThanOrEqual(220);
    expect(layout.buttons).toHaveLength(2);
    for (const button of layout.buttons) {
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.left).toBeGreaterThanOrEqual(0);
      expect(button.right).toBeLessThanOrEqual(layout.rootClientWidth + 1);
    }
  });

  test("keeps the desktop document across the workbench without an Agent column", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/editor");
    await expect(page.getByRole("button", { name: "Toggle theme" })).toBeEnabled();

    const layout = await page.evaluate(() => {
      const main = document.querySelector<HTMLElement>("#main-content");
      const workspace = document.querySelector<HTMLElement>("[data-editor-workspace]");
      const documentPane = document.querySelector<HTMLElement>("#editor-document-panel");
      return {
        mainClientHeight: main?.clientHeight,
        mainScrollHeight: main?.scrollHeight,
        main: main?.getBoundingClientRect(),
        workspace: workspace?.getBoundingClientRect(),
        documentPane: documentPane?.getBoundingClientRect(),
      };
    });

    expect(layout.mainClientHeight).toBeDefined();
    expect(layout.mainScrollHeight).toBeLessThanOrEqual(layout.mainClientHeight! + 1);
    expect(layout.workspace!.bottom).toBeLessThanOrEqual(layout.main!.bottom + 1);
    expect(Math.abs(layout.documentPane!.width - layout.workspace!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.documentPane!.left - layout.workspace!.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(layout.documentPane!.right - layout.workspace!.right)).toBeLessThanOrEqual(1);
    await expect(page.locator("#editor-agent-panel, [data-agent-pane]")).toHaveCount(0);
    await expect(page.locator("#editor-ai-review")).toBeHidden();
    await expect(page.getByRole("group", { name: "Document view" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Editor panel" })).toBeHidden();
  });

  test("switches mobile document views and keeps an inline AI request when reopened", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/editor");
    await expect(page.getByRole("button", { name: "Toggle theme" })).toBeEnabled();

    const panels = page.getByRole("group", { name: "Document view" });
    const sourceButton = panels.getByRole("button", { name: "Source", exact: true });
    const previewButton = panels.getByRole("button", { name: "Preview", exact: true });
    const aiButton = page.getByRole("button", { name: "Edit with AI" });
    const source = page.getByRole("combobox", { name: "MDX source" });
    await expect(source).toHaveValue("# Untitled\n\n");
    await source.fill("# Mobile draft\n");
    await expect(source).toHaveValue("# Mobile draft\n");

    await expect(page.locator("#editor-agent-panel, [data-agent-pane]")).toHaveCount(0);
    await expect(panels.getByRole("button", { name: "Agent", exact: true })).toHaveCount(0);
    await expect(page.locator("#editor-ai-review")).toBeHidden();
    await aiButton.click();
    await expect(aiButton).toHaveAttribute("aria-expanded", "true");
    await expect(source).toBeVisible();
    const instruction = page.getByRole("textbox", { name: "What should change?" });
    await instruction.fill("Tighten the title.");
    await expect(instruction).toHaveValue("Tighten the title.");
    await aiButton.click();
    await expect(page.locator("#editor-ai-review")).toBeHidden();

    await previewButton.click();
    await expect(previewButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "Mobile draft" })).toBeVisible();
    await sourceButton.click();
    await expect(sourceButton).toHaveAttribute("aria-pressed", "true");
    await expect(source).toHaveValue("# Mobile draft\n");

    await aiButton.click();
    await expect(instruction).toHaveValue("Tighten the title.");
    await expect(panels.locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(source).toBeVisible();
  });

  test("keeps the document and inline AI review across the 900px Editor breakpoint", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 844 });
    await page.goto("/editor");

    const mobilePanels = page.getByRole("group", { name: "Document view" });
    await page.getByRole("button", { name: "Edit with AI" }).click();
    await expect(page.locator("#editor-ai-review")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "MDX source" })).toBeVisible();
    await page.getByRole("textbox", { name: "What should change?" }).fill("Keep this instruction.");

    await page.setViewportSize({ width: 901, height: 844 });
    await expect(page.getByRole("group", { name: "Document view" })).toBeVisible();
    await expect(mobilePanels).toBeVisible();
    await expect(page.locator("#editor-document-panel")).toBeVisible();
    await expect(page.locator("#editor-ai-review")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "What should change?" })).toHaveValue(
      "Keep this instruction."
    );
    await expect(page.locator("#editor-agent-panel")).toHaveCount(0);
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
    const ai = page.getByRole("button", { name: "Edit with AI" });
    await ai.focus();
    await page.keyboard.press("Tab");

    await expect(source).toBeFocused();
    await expect
      .poll(() => source.evaluate((element) => getComputedStyle(element).outlineStyle))
      .toBe("solid");
  });

  test("keeps Agent edits scoped to the draft when no provider is configured", async ({ page }) => {
    await page.goto("/editor");

    await expect(page.locator("#editor-ai-review")).toBeHidden();
    await page.getByRole("button", { name: "Edit with AI" }).click();
    const agent = page.getByRole("complementary", { name: "Edit with AI" });
    await expect(agent).toBeVisible();
    await expect(
      agent.getByText(
        "The request and current draft are sent to your configured provider. After approval, changes follow this draft’s browser autosave. Export remains separate."
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

  test("keeps inline AI review controls inside a 390px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/editor");

    await page.getByRole("button", { name: "Edit with AI" }).click();
    const agent = page.getByRole("complementary", { name: "Edit with AI" });
    const request = agent.getByRole("textbox", { name: "What should change?" });
    await expect(request).toBeVisible();

    const layout = await page.evaluate(() => {
      const root = document.documentElement;
      const aside = document.querySelector<HTMLElement>("#editor-ai-review aside[aria-labelledby]");
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
