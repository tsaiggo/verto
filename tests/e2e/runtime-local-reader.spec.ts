import { expect, test, type Page } from "playwright/test";

const RUNTIME_FILE_ID = "browser-local:Product%20Notes/guides/product-guide.md";
const RUNTIME_SOURCE = `# Product Guide

This local document is rendered inside the complete Verto reading workspace.

## Start here

Use the same tabs, reading controls, annotations, progress tracking, and table of contents as bundled documents.

## Working notes

${Array.from(
  { length: 36 },
  (_, index) =>
    `Paragraph ${index + 1}. A local note remains readable and recoverable across the desktop workflow.`
).join("\n\n")}
`;

async function seedRuntimeDocument(page: Page) {
  await page.goto("/");
  await page.evaluate(
    ({ id, source }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("verto-browser-local-files", 1);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains("files")) {
            database.createObjectStore("files", { keyPath: "id" });
          }
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("files", "readwrite");
          transaction.objectStore("files").put({
            id,
            folder: "Product Notes",
            path: ["guides", "product-guide.md"],
            text: source,
            size: source.length,
            mtime: Date.now(),
          });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        };
      }),
    { id: RUNTIME_FILE_ID, source: RUNTIME_SOURCE }
  );
}

test.describe("Desktop runtime-local reader", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("uses the local library, one document toolbar, and a recoverable context rail", async ({
    page,
  }) => {
    await seedRuntimeDocument(page);
    const params = new URLSearchParams({
      file: RUNTIME_FILE_ID,
      title: "Product Guide",
      ext: ".md",
    });
    await page.goto(`/runtime/local?${params.toString()}`);

    const workspaceTabs = page.getByRole("navigation", { name: "Workspace tabs" });
    await expect(workspaceTabs.getByRole("link", { name: "Local library" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(page.getByRole("link", { name: "Skip to document" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Local library" })).toBeVisible();

    const document = page.getByRole("region", { name: "Document" });
    await expect(document).toBeVisible();
    await expect(page.getByRole("heading", { name: "Product Guide" })).toHaveCount(1);
    await expect(document).toContainText("Local file");
    await expect(document).toContainText("MD");

    const modeControl = document.getByRole("group", { name: "Workspace mode" });
    await expect(modeControl).toHaveCount(1);
    await expect(modeControl.getByRole("button", { name: "Read" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(modeControl.getByRole("button", { name: "Edit" })).toBeDisabled();
    await expect(modeControl.getByRole("button", { name: "Split" })).toBeDisabled();

    const article = document.locator("[data-article]");
    await expect(article).toContainText("complete Verto reading workspace");
    await expect(article).toContainText("Paragraph 36.");

    const context = page.getByRole("complementary", { name: "Document context" });
    await expect(context).toBeVisible();
    const contextViews = context.getByRole("tablist", { name: "Document context views" });
    await expect(contextViews).toBeVisible();

    const outlineTab = context.getByRole("tab", { name: "Outline" });
    await expect(outlineTab).toHaveAttribute("aria-selected", "true");
    await expect(context.getByRole("button", { name: "Start here" })).toBeVisible();
    await expect(context.getByRole("button", { name: "Working notes" })).toBeVisible();

    const notesTab = context.getByRole("tab", { name: "Notes" });
    await notesTab.click();
    await expect(notesTab).toHaveAttribute("aria-selected", "true");
    await expect(context.getByRole("heading", { name: "No notes on this page" })).toBeVisible();

    const linksTab = context.getByRole("tab", { name: "Links" });
    await linksTab.click();
    await expect(linksTab).toHaveAttribute("aria-selected", "true");
    await expect(context.getByRole("heading", { name: "No linked pages yet" })).toBeVisible();

    const agentTab = context.getByRole("tab", { name: "Agent" });
    await agentTab.click();
    await expect(agentTab).toHaveAttribute("aria-selected", "true");

    await context.getByRole("button", { name: "Close document context" }).click();
    await expect(page.getByRole("tablist", { name: "Document context views" })).toHaveCount(0);

    const openContext = page.getByRole("button", { name: "Open document context" });
    await expect(openContext).toBeVisible();
    await openContext.click();
    await expect(page.getByRole("tab", { name: "Outline" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await expect(page.getByRole("tab", { name: "Product Guide" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "More workspace actions" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reading settings" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Bookmark this document" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add to collection" })).toHaveCount(0);
    await expect(page.locator("main")).toHaveCount(1);
  });

  test("keeps document context open when Escape dismisses the slash menu", async ({ page }) => {
    await page.goto("/runtime/local?preview=workspace");
    const document = page.getByRole("region", { name: "Document" });
    await document.getByRole("button", { name: "Edit" }).click();
    const source = document.getByRole("combobox", { name: "MDX source" });
    await source.fill("/quo");

    await expect(page.getByRole("listbox", { name: "Insert a block" })).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Document context views" })).toBeVisible();
    await source.press("Escape");
    await expect(page.getByRole("listbox", { name: "Insert a block" })).toHaveCount(0);
    await expect(page.getByRole("tablist", { name: "Document context views" })).toBeVisible();
    await expect(source).toHaveValue("/quo");
  });
});

test.describe("Compact runtime-local reader", () => {
  test.use({ viewport: { width: 720, height: 800 } });

  test("keeps the document primary and exposes both side regions as dismissible drawers", async ({
    page,
  }) => {
    await seedRuntimeDocument(page);
    const params = new URLSearchParams({
      file: RUNTIME_FILE_ID,
      title: "Product Guide",
      ext: ".md",
    });
    await page.goto(`/runtime/local?${params.toString()}`);

    const sidebar = page.locator("#local-library-sidebar");
    await expect(sidebar).toBeHidden();
    await expect(page.getByRole("heading", { name: "Product Guide" })).toBeVisible();

    await page.getByRole("button", { name: "Open local library" }).click();
    await expect(sidebar).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sidebar).toBeHidden();

    await page.getByRole("button", { name: "Open document context" }).click();
    await expect(page.getByRole("tablist", { name: "Document context views" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tablist", { name: "Document context views" })).toHaveCount(0);

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client);
  });
});
