import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { expect, test, type Page } from "playwright/test";
import { editableEpubFixture } from "./helpers/epub-mdx-book";

async function openOriginal(page: Page, bytes: Buffer) {
  await page.goto("/library");
  await page.getByLabel("Import EPUB or PDF file").setInputFiles({
    name: "portable-field-book.epub",
    mimeType: "application/epub+zip",
    buffer: bytes,
  });
  await expect(page.getByRole("status").filter({ hasText: "imported" })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("link", { name: "Open book", exact: true }).click();
  await expect(page).toHaveURL(/\/read\/file\?document=/);
  return new URL(page.url()).searchParams.get("document")!;
}

async function libraryCounts(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("verto.articles");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<Record<string, number>>((resolve, reject) => {
        const names = ["articles", "documents", "mdx-books", "book-assets"];
        const transaction = database.transaction(names, "readonly");
        const requests = names.map((name) => transaction.objectStore(name).count());
        transaction.oncomplete = () =>
          resolve(Object.fromEntries(names.map((name, index) => [name, requests[index].result])));
        transaction.onerror = transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  });
}

test("previews an EPUB, saves editable chapters, exports current MDX and retains the original", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const bytes = await editableEpubFixture();
  const remoteRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("example.invalid")) remoteRequests.push(request.url());
  });
  const originalId = await openOriginal(page, bytes);
  await page.getByRole("button", { name: "Convert to MDX", exact: true }).click();
  const conversion = page.getByRole("region", { name: "EPUB to MDX conversion" });
  await expect(conversion.getByRole("heading", { name: "A portable field book" })).toBeVisible();
  await expect(conversion).toContainText("Verto conversion test author");
  await expect(conversion).toContainText("2 chapter pages · 1 local image");
  const chapters = conversion.getByRole("navigation", { name: "Conversion chapters" });
  await expect(
    chapters.getByRole("button", { name: "Field observations", exact: true })
  ).toBeVisible();
  const preview = conversion.locator("[data-conversion-preview]");
  await expect(preview).toContainText("important observation");
  await expect(preview.getByRole("table")).toContainText("Desk");
  const diagram = preview.getByRole("img", { name: "A local diagram" });
  await expect(diagram).toHaveAttribute("src", /^blob:/);
  await expect
    .poll(() => diagram.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  expect((await libraryCounts(page))["mdx-books"]).toBe(0);
  await chapters.getByRole("button", { name: "Further reading", exact: true }).click();
  await expect(preview).toContainText("This second chapter stays connected to its book.");
  await chapters.getByRole("button", { name: "Opening chapter", exact: true }).click();
  await expect(preview).toContainText("Original words are kept beside an editable copy.");
  await conversion.getByRole("button", { name: "Save MDX book", exact: true }).click();
  await expect(conversion.getByRole("status")).toContainText("MDX book saved");
  const rootHref = await conversion
    .getByRole("link", { name: "Open MDX book", exact: true })
    .getAttribute("href");
  expect(rootHref).toMatch(/^\/read\/local\?document=/);
  await conversion.getByRole("link", { name: "Open MDX book", exact: true }).click();
  await expect(page).toHaveURL(rootHref!);
  await page
    .locator("[data-article]")
    .getByRole("link", { name: "Opening chapter", exact: true })
    .click();
  await expect(page.locator("[data-article]")).toContainText("important observation");
  const chapterHref = `/read/local?document=${new URL(page.url()).searchParams.get("document")!}`;
  await page
    .locator("summary:visible")
    .filter({ hasText: /^On this page$/ })
    .click();
  const outlineLink = page
    .getByRole("navigation", { name: "Table of Contents", exact: true })
    .getByRole("link", { name: "Field observations", exact: true });
  await expect(outlineLink).toHaveText("Field observations");
  await expect(outlineLink).toHaveAttribute("href", "#epub-001-observations");
  await outlineLink.click();
  await expect(page).toHaveURL(`${chapterHref}#epub-001-observations`);
  const observationsAnchor = page.locator("[data-article] #epub-001-observations");
  await expect(observationsAnchor).toBeAttached();
  await expect
    .poll(() =>
      observationsAnchor.evaluate((anchor) => {
        const position = anchor.getBoundingClientRect();
        const scroll = anchor.closest("[data-page-scroll]")!.getBoundingClientRect();
        return position.top >= scroll.top - 1 && position.top < scroll.bottom;
      })
    )
    .toBe(true);
  await expect(
    page.locator("[data-article]").getByRole("img", { name: "A local diagram" })
  ).toHaveAttribute("src", /^blob:/);
  await page.locator("[data-article]").getByRole("link", { name: "Continue to details" }).click();
  await expect(page.locator("[data-article]")).toContainText(
    "This second chapter stays connected to its book."
  );
  await expect(page).toHaveURL(/#epub-002-details$/);
  await page
    .locator("[data-article]")
    .getByRole("link", { name: "Return to observations" })
    .click();
  await expect(page).toHaveURL(`${chapterHref}#epub-001-observations`);
  await expect(page.getByRole("navigation", { name: "Page hierarchy" })).toContainText(
    "A portable field book"
  );
  const pages = page.getByRole("list", { name: "Saved pages" });
  await expect(pages.getByRole("link", { name: "Opening chapter", exact: true })).toBeVisible();
  await expect(pages.getByRole("link", { name: "Further reading", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Edit Opening chapter", exact: true }).click();
  const source = page.getByRole("combobox", { name: "MDX source" });
  await expect(source).toBeEditable();
  const edited = `${await source.inputValue()}\nAn observation added after conversion.\n`;
  await source.fill(edited);
  await expect(page.getByRole("status").filter({ hasText: "Saved in this browser" })).toBeVisible();
  const exporting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export MDX book", exact: true }).click();
  const download = await exporting;
  const zip = await JSZip.loadAsync(await readFile((await download.path())!));
  const rootFile = Object.keys(zip.files).find((filename) => filename.endsWith("/index.mdx"))!;
  expect(rootFile).toBeTruthy();
  expect(await zip.file(rootFile)!.async("string")).toContain("Opening chapter");
  const chapterFile = Object.keys(zip.files).find((filename) =>
    filename.endsWith("/001-opening-chapter.mdx")
  )!;
  expect(await zip.file(chapterFile)!.async("string")).toBe(edited);
  expect(
    Object.keys(zip.files).filter((filename) => /\/assets\/[^/]+\.png$/.test(filename))
  ).toHaveLength(1);
  const metadataFile = Object.keys(zip.files).find((filename) => filename.endsWith("/book.json"))!;
  expect(JSON.parse(await zip.file(metadataFile)!.async("string")).sourceDocumentId).toBe(
    originalId
  );
  await page.getByRole("link", { name: "Original EPUB", exact: true }).click();
  await expect(page).toHaveURL(`/read/file?document=${originalId}`);
  const exportingOriginal = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export original", exact: true }).click();
  expect(await readFile((await (await exportingOriginal).path())!)).toEqual(bytes);
  await page.getByRole("button", { name: "Convert to MDX", exact: true }).click();
  await expect(conversion.getByRole("status")).toContainText("already saved");
  await expect(
    conversion.getByRole("link", { name: "Open MDX book", exact: true })
  ).toHaveAttribute("href", rootHref!);
  await expect(conversion.getByRole("button", { name: "Save MDX book", exact: true })).toHaveCount(
    0
  );
  expect(await libraryCounts(page)).toEqual({
    articles: 3,
    documents: 1,
    "mdx-books": 1,
    "book-assets": 1,
  });
  expect(remoteRequests).toEqual([]);
  expect(
    await page.evaluate(
      () => (window as unknown as { __converted_epub_script?: boolean }).__converted_epub_script
    )
  ).toBeUndefined();
});

test("a failed book transaction retains the preview and retries without partial pages", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openOriginal(page, await editableEpubFixture());
  await page.getByRole("button", { name: "Convert to MDX", exact: true }).click();
  const conversion = page.getByRole("region", { name: "EPUB to MDX conversion" });
  await expect(
    conversion.getByRole("button", { name: "Save MDX book", exact: true })
  ).toBeVisible();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore["add"]>) {
      if (this.name === "mdx-books") {
        IDBObjectStore.prototype.add = original;
        throw new DOMException("The device is full. Preview is retained.", "QuotaExceededError");
      }
      return original.apply(this, args);
    };
  });
  await conversion.getByRole("button", { name: "Save MDX book", exact: true }).click();
  await expect(conversion.getByRole("alert")).toContainText("device is full");
  await expect(conversion.locator("[data-conversion-preview]")).toContainText(
    "important observation"
  );
  await expect(conversion.getByRole("link", { name: "Open MDX book", exact: true })).toHaveCount(0);
  expect(await libraryCounts(page)).toEqual({
    articles: 0,
    documents: 1,
    "mdx-books": 0,
    "book-assets": 0,
  });
  await conversion.getByRole("button", { name: "Retry saving MDX book", exact: true }).click();
  await expect(conversion.getByRole("status")).toContainText("MDX book saved");
  expect(await libraryCounts(page)).toEqual({
    articles: 3,
    documents: 1,
    "mdx-books": 1,
    "book-assets": 1,
  });
});

test("ordinary YAML examples render and temporary book lookup failures can be retried", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/editor");
  const source = page.getByRole("combobox", { name: "MDX source" });
  await expect(source).toBeEditable();
  await page.getByRole("textbox", { name: "Filename" }).fill("format-example.mdx");
  await source.fill(
    '# A data format example\n\n```yaml\nvertoBookId: "illustrative-id"\n```\n\nThis is an ordinary article.\n'
  );
  await expect(page.getByRole("status").filter({ hasText: "Saved in this browser" })).toBeVisible();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator("[data-editor-preview]")).toContainText("vertoBookId:");
  await expect(page.locator("[data-editor-preview]")).toContainText("This is an ordinary article.");
  await expect(page.locator("[data-editor-preview]").getByRole("alert")).toHaveCount(0);
  await page.getByRole("link", { name: "Read", exact: true }).click();
  await expect(page.locator("[data-article]")).toContainText("This is an ordinary article.");
  await expect(page.locator("[data-article]")).toContainText("vertoBookId:");

  const originalId = await openOriginal(page, await editableEpubFixture());
  await page.getByRole("button", { name: "Convert to MDX", exact: true }).click();
  const conversion = page.getByRole("region", { name: "EPUB to MDX conversion" });
  await conversion.getByRole("button", { name: "Save MDX book", exact: true }).click();
  const bookHref = await conversion
    .getByRole("link", { name: "Open MDX book", exact: true })
    .getAttribute("href");
  expect(bookHref).toBeTruthy();
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.getAll;
    Object.defineProperty(window, "__restoreBookLookup", {
      value: () => {
        IDBObjectStore.prototype.getAll = original;
      },
    });
    // Keep the initial failed load deterministic under development Strict Mode.
    // Only book lookup fails; reading the saved article still succeeds.
    IDBObjectStore.prototype.getAll = function (...args: Parameters<IDBObjectStore["getAll"]>) {
      if (this.name === "mdx-books")
        throw new DOMException("Temporary book lookup failure.", "UnknownError");
      return original.apply(this, args);
    };
  });
  await page.goto(bookHref!);
  await expect(page.getByRole("button", { name: "Retry book actions", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry book resources", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry book navigation", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Export MDX book", exact: true })).toHaveCount(0);
  await page.evaluate(() =>
    (window as unknown as { __restoreBookLookup: () => void }).__restoreBookLookup()
  );
  await page.getByRole("button", { name: "Retry book resources", exact: true }).click();
  await expect(
    page.locator("[data-article]").getByRole("link", { name: "Opening chapter", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry book actions", exact: true }).click();
  await expect(page.getByRole("button", { name: "Export MDX book", exact: true })).toBeEnabled();
  await expect(page.getByRole("link", { name: "Original EPUB", exact: true })).toHaveAttribute(
    "href",
    `/read/file?document=${originalId}`
  );
  await page.getByRole("button", { name: "Retry book navigation", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Book chapters", exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  const exporting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export MDX book", exact: true }).click();
  const zip = await JSZip.loadAsync(await readFile((await (await exporting).path())!));
  expect(Object.keys(zip.files).some((filename) => filename.endsWith("/index.mdx"))).toBe(true);
});
