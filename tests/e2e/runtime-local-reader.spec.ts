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

  test("uses the full reader identity, tabs, context rail, and native local content", async ({
    page,
  }) => {
    await seedRuntimeDocument(page);
    const params = new URLSearchParams({
      file: RUNTIME_FILE_ID,
      title: "Product Guide",
      ext: ".md",
    });
    await page.goto(`/runtime/local?${params.toString()}`);

    const shell = page.locator("[data-shell-root]");
    await expect(shell).toHaveClass(/app-shell--reader/);
    await expect(page.locator("[data-page-identity]")).toContainText("Product Guide");
    await expect(page.locator("[data-page-identity]")).toContainText("guides/product-guide.md");
    await expect(page.getByRole("heading", { name: "Product Guide" })).toHaveCount(1);

    const currentTab = page.getByRole("tab", { name: "Product Guide" });
    await expect(currentTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Reading settings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bookmark this document" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to collection" })).toBeVisible();

    await expect(page.locator("[data-article]")).toContainText("complete Verto reading workspace");
    await expect(page.locator("[data-context-panel]")).toContainText("Start here");
    await expect(page.locator("[data-context-panel]")).toContainText("Working notes");

    const storedRuntimeTab = await page.evaluate(() => {
      const raw = localStorage.getItem("verto:open-tabs");
      const tabs = raw ? (JSON.parse(raw) as Array<{ path: string; title: string }>) : [];
      return tabs.find((tab) => tab.title === "Product Guide") ?? null;
    });
    expect(storedRuntimeTab?.path).toContain("/runtime/local?file=");
    expect(storedRuntimeTab?.path).toContain("title=Product+Guide");
  });
});
