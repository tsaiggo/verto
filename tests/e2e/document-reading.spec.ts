import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "playwright/test";
import { epubFixture, pdfFixture } from "./helpers/reading-files";

async function importBook(page: Page, filename: string, buffer: Buffer, mimeType: string) {
  await page.goto("/library");
  await page
    .getByLabel("Import EPUB or PDF file")
    .setInputFiles({ name: filename, mimeType, buffer });
  await expect(page.getByRole("status").filter({ hasText: "imported" })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("link", { name: "Open book", exact: true }).click();
  await expect(page).toHaveURL(/\/read\/file\?document=/);
  return new URL(page.url()).searchParams.get("document")!;
}

test("imports an EPUB, follows chapters, restores reading position and exports exact original bytes", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const buffer = await epubFixture();
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("example.invalid")) requests.push(request.url());
  });
  await importBook(page, "field-guide.epub", buffer, "application/epub+zip");
  await expect(
    page.getByRole("heading", { name: "Reading field guide", exact: true })
  ).toBeVisible();
  await expect(page.locator("[data-article]")).toContainText(
    "A portable book belongs to its reader."
  );
  expect(
    await page.evaluate(
      () => (window as unknown as { __epub_script_ran?: boolean }).__epub_script_ran
    )
  ).toBeUndefined();
  expect(requests).toEqual([]);
  await page.getByRole("link", { name: "Continue to details" }).click();
  await expect(page.locator("[data-article]")).toContainText(
    "Keep your source and your reading progress."
  );
  await expect(page.locator("[aria-label='Book navigation']")).toContainText("2 / 2");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          localStorage.getItem("verto:document-positions") ??
          localStorage.getItem("verto.document-positions") ??
          Object.values(localStorage).join("\n")
      )
    )
    .toContain('"index":1');
  await page.reload();
  await expect(page.locator("[data-article]")).toContainText(
    "Keep your source and your reading progress."
  );
  const exportPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export original" }).click();
  const exported = await exportPromise;
  expect(exported.suggestedFilename()).toBe("field-guide.epub");
  expect(await readFile((await exported.path())!)).toEqual(buffer);
  await page.getByRole("searchbox", { name: "Find in book" }).fill("portable");
  await expect(page.locator("[aria-label='Book search results']")).toContainText("First chapter");
  await page
    .locator("[aria-label='Book search results']")
    .getByRole("button", { name: "First chapter" })
    .click();
  await expect(page.locator("[data-article] mark")).toHaveText("portable");
});

test("imports and renders a PDF with selectable text, page navigation and independent document tabs", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const buffer = pdfFixture();
  const id = await importBook(page, "notebook.pdf", buffer, "application/pdf");
  await expect(page.getByRole("heading", { name: "Research notebook", exact: true })).toBeVisible();
  await expect(page.locator("[data-pdf-page] canvas")).toBeVisible();
  await expect(page.locator("[aria-label='Selectable page text']")).toContainText(
    "Research notebook"
  );
  await page.getByRole("searchbox", { name: "Find in PDF" }).fill("second page");
  await expect(page.locator("[aria-label='PDF search results']")).toContainText("1 matching pages");
  await page
    .locator("[aria-label='PDF search results']")
    .getByRole("button", { name: "Page 2", exact: true })
    .click();
  await expect(page.locator("[aria-label='Selectable page text']")).toContainText(
    "Portable reading second page"
  );
  await page.getByRole("button", { name: "Clear PDF search" }).click();
  await page.getByRole("button", { name: "Previous page", exact: true }).click();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.locator("[aria-label='Selectable page text']")).toContainText(
    "Portable reading second page"
  );
  await expect
    .poll(() => page.evaluate(() => Object.values(localStorage).join("\n")))
    .toContain('"index":1');
  await page.reload();
  await expect(page.locator("[aria-label='Selectable page text']")).toContainText(
    "Portable reading second page"
  );
  const exporting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export original" }).click();
  const download = await exporting;
  expect(await readFile((await download.path())!)).toEqual(buffer);
  await importBook(page, "field-guide.epub", await epubFixture(), "application/epub+zip");
  await expect(page.getByRole("tab", { name: "Research notebook", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Research notebook", exact: true }).click();
  await expect(page).toHaveURL(`/read/file?document=${id}`);
  await expect(page.locator("[aria-label='Selectable page text']")).toContainText(
    "Portable reading second page"
  );
});

test("rejects corrupt files without claiming a saved import and allows a valid retry", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/library");
  await page.getByLabel("Import EPUB or PDF file").setInputFiles({
    name: "broken.epub",
    mimeType: "application/epub+zip",
    buffer: Buffer.from("not an archive"),
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText("couldn’t be imported");
  await expect(page.getByRole("link", { name: "Open book", exact: true })).toHaveCount(0);
  await page
    .getByLabel("Import EPUB or PDF file")
    .setInputFiles({ name: "good.pdf", mimeType: "application/pdf", buffer: pdfFixture() });
  await expect(page.getByRole("status").filter({ hasText: "imported" })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("link", { name: "Open book", exact: true }).click();
  await expect(page.locator("[aria-label='Selectable page text']")).toContainText(
    "Research notebook"
  );
});

test("missing imported document has a recoverable library path", async ({ page }) => {
  await page.goto("/read/file?document=missing-file");
  await expect(page.getByRole("heading", { name: "This document isn’t saved here" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to library" })).toHaveAttribute(
    "href",
    "/library"
  );
});
