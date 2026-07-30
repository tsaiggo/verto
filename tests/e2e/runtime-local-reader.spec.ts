import { expect, test, type Page } from "playwright/test";

const productionServer = process.env.PLAYWRIGHT_SERVER === "production";

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

  test("orders the outline, document, and Agent while keeping the library in a drawer", async ({
    page,
  }) => {
    await seedRuntimeDocument(page);
    await openRuntimeDocument(page);

    const workspaceTabs = page.getByRole("navigation", { name: "Workspace tabs" });
    await expect(workspaceTabs.getByRole("link", { name: "Local library" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(page.getByRole("link", { name: "Skip to document" })).toBeVisible();

    const library = page.getByRole("complementary", { name: "Local library" });
    await expect(library).toBeHidden();

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

    const outline = page.getByRole("complementary", { name: "Page outline" });
    const agent = page.getByRole("complementary", { name: "Agent" });
    await expect(outline).toBeVisible();
    await expect(agent).toBeVisible();

    const contextViews = outline.getByRole("tablist", { name: "Document context views" });
    await expect(contextViews).toBeVisible();

    const outlineTab = outline.getByRole("tab", { name: "Outline" });
    await expect(outlineTab).toHaveAttribute("aria-selected", "true");
    await expect(outline.getByRole("button", { name: "Start here" })).toBeVisible();
    await expect(outline.getByRole("button", { name: "Working notes" })).toBeVisible();

    const notesTab = outline.getByRole("tab", { name: "Notes" });
    await notesTab.click();
    await expect(notesTab).toHaveAttribute("aria-selected", "true");
    await expect(outline.getByRole("heading", { name: "No notes on this page" })).toBeVisible();

    const linksTab = outline.getByRole("tab", { name: "Links" });
    await linksTab.click();
    await expect(linksTab).toHaveAttribute("aria-selected", "true");
    await expect(outline.getByRole("heading", { name: "No linked pages yet" })).toBeVisible();
    await expect(outline.getByRole("tab", { name: "Agent" })).toHaveCount(0);

    const metrics = await measureRuntimeWorkspace(page);
    expect(metrics.order).toEqual(["toc", "document", "agent"]);
    expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
    expect(metrics.toc.right).toBeLessThanOrEqual(metrics.document.left);
    expect(metrics.document.right).toBeLessThanOrEqual(metrics.agent.left);
    expect(metrics.document.width).toBeGreaterThan(400);
    expect(metrics.document.width).toBeLessThanOrEqual(761);
    expect(metrics.toc.width).toBeGreaterThanOrEqual(170);
    expect(metrics.agent.width).toBeGreaterThanOrEqual(315);

    await agent.getByRole("button", { name: "Close Agent" }).click();
    await expect(page.getByRole("button", { name: "Open Agent" })).toBeVisible();
    await expect(outline).toBeVisible();
    await page.getByRole("button", { name: "Open Agent" }).click();
    await expect(page.getByRole("complementary", { name: "Agent" })).toBeVisible();

    const documentBeforeLibrary = await document.boundingBox();
    await page.getByRole("button", { name: "Open local library" }).click();
    await expect(library).toBeVisible();
    const documentWithLibrary = await document.boundingBox();
    expect(documentWithLibrary).toEqual(documentBeforeLibrary);
    await page.keyboard.press("Escape");
    await expect(library).toBeHidden();

    await expect(page.getByRole("tab", { name: "Product Guide" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "More workspace actions" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reading settings" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Bookmark this document" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add to collection" })).toHaveCount(0);
    await expect(page.locator("main")).toHaveCount(1);
  });

  test("keeps the desktop rails open when Escape dismisses the slash menu", async ({ page }) => {
    test.skip(
      productionServer,
      "This test exercises the intentionally development-only preview workspace."
    );

    await page.goto("/runtime/local?preview=workspace");
    const document = page.getByRole("region", { name: "Document" });
    await document.getByRole("button", { name: "Edit" }).click();
    const source = document.getByRole("combobox", { name: "MDX source" });
    await source.fill("/quo");

    await expect(page.getByRole("listbox", { name: "Insert a block" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Page outline" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Agent" })).toBeVisible();
    await source.press("Escape");
    await expect(page.getByRole("listbox", { name: "Insert a block" })).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Page outline" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Agent" })).toBeVisible();
    await expect(source).toHaveValue("/quo");
  });
});

test.describe("Compact runtime-local reader", () => {
  test.use({ viewport: { width: 1024, height: 800 } });

  test("keeps the document primary and exposes the library and Agent as drawers", async ({
    page,
  }) => {
    await seedRuntimeDocument(page);
    await openRuntimeDocument(page);

    const sidebar = page.locator("#local-library-sidebar");
    await expect(sidebar).toBeHidden();
    await expect(page.getByRole("heading", { name: "Product Guide" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Page outline" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Open Agent" })).toBeVisible();

    const documentRegion = page.getByRole("region", { name: "Document" });
    const documentBeforeDrawers = await documentRegion.boundingBox();

    await page.getByRole("button", { name: "Open local library" }).click();
    await expect(sidebar).toBeVisible();
    expect(await documentRegion.boundingBox()).toEqual(documentBeforeDrawers);
    await page.keyboard.press("Escape");
    await expect(sidebar).toBeHidden();

    await page.getByRole("button", { name: "Open Agent" }).click();
    const agent = page.getByRole("complementary", { name: "Agent" });
    await expect(agent).toBeVisible();
    expect(await documentRegion.boundingBox()).toEqual(documentBeforeDrawers);
    const agentBox = await agent.boundingBox();
    expect(agentBox).not.toBeNull();
    expect(agentBox!.x).toBeLessThan(documentBeforeDrawers!.x + documentBeforeDrawers!.width);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open Agent" })).toBeVisible();

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client);
  });
});

async function openRuntimeDocument(page: Page) {
  const params = new URLSearchParams({
    file: RUNTIME_FILE_ID,
    title: "Product Guide",
    ext: ".md",
  });
  await page.goto(`/runtime/local?${params.toString()}`);
}

interface RuntimeWorkspaceMetrics {
  viewportWidth: number;
  rootScrollWidth: number;
  order: string[];
  toc: DOMRectMetric;
  document: DOMRectMetric;
  agent: DOMRectMetric;
}

interface DOMRectMetric {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

async function measureRuntimeWorkspace(page: Page): Promise<RuntimeWorkspaceMetrics> {
  return page.locator("[data-reader-workbench]").evaluate((workbench) => {
    const rectangle = (element: Element): DOMRectMetric => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    };
    const required = (selector: string) => {
      const element = workbench.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing runtime-local workspace element: ${selector}`);
      return element;
    };

    return {
      viewportWidth: innerWidth,
      rootScrollWidth: document.documentElement.scrollWidth,
      order: Array.from(workbench.children).map((element) => {
        if (element.hasAttribute("data-context-panel")) return "toc";
        if (element.hasAttribute("data-reader-document")) return "document";
        if (element.hasAttribute("data-agent-slot")) return "agent";
        return "unknown";
      }),
      toc: rectangle(required("[data-context-panel]")),
      document: rectangle(required("[data-reader-document]")),
      agent: rectangle(required("[data-agent-slot]")),
    };
  });
}
