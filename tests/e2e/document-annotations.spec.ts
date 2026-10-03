import { expect, test } from "playwright/test";
import { pdfFixture } from "./helpers/reading-files";

test("PDF copy and annotations remain available on a LAN HTTP origin", async ({ page }) => {
  await page.addInitScript(() => {
    // Match APIs omitted on an ordinary insecure LAN origin.
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/library");
  await page
    .getByLabel("Import EPUB or PDF file")
    .setInputFiles({ name: "lan.pdf", mimeType: "application/pdf", buffer: pdfFixture() });
  await expect(page.getByRole("status").filter({ hasText: "imported" })).toBeVisible();
  await page.getByRole("link", { name: "Open book", exact: true }).click();
  const layer = page.locator("[aria-label='Selectable page text']");
  await expect(layer).toContainText("Research notebook");
  await layer
    .locator("span")
    .first()
    .evaluate((span) => {
      const range = document.createRange();
      range.selectNodeContents(span);
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
  await page.getByRole("button", { name: "Copy text", exact: true }).click();
  await expect(page.getByText("Copied to clipboard", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Highlight", exact: true }).click();
  await expect(layer.locator("mark.annotation-highlight")).toHaveText("Research notebook");
  expect(errors).toEqual([]);
});

test("PDF passage highlights and notes persist per page through zoom and reopening", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/library");
  await page
    .getByLabel("Import EPUB or PDF file")
    .setInputFiles({ name: "annotated.pdf", mimeType: "application/pdf", buffer: pdfFixture() });
  await expect(page.getByRole("status").filter({ hasText: "imported" })).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("link", { name: "Open book", exact: true }).click();
  await expect(page).toHaveURL(/\/read\/file\?document=/);
  const id = new URL(page.url()).searchParams.get("document")!;
  const layer = page.locator("[aria-label='Selectable page text']");
  await expect(layer).toContainText("Research notebook");
  await layer
    .locator("span")
    .first()
    .evaluate((span) => {
      const range = document.createRange();
      range.selectNodeContents(span);
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
  await expect(page.getByRole("toolbar", { name: "Selection actions" })).toBeVisible();
  await page.getByRole("button", { name: "Highlight", exact: true }).click();
  await expect(layer.locator("mark.annotation-highlight")).toHaveText("Research notebook");
  await page.getByRole("combobox", { name: "PDF zoom" }).selectOption("1.5");
  await expect(layer.locator("mark.annotation-highlight")).toHaveText("Research notebook");
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(layer).toContainText("Portable reading second page");
  await expect(layer.locator("mark.annotation-highlight")).toHaveCount(0);
  await layer
    .locator("span")
    .first()
    .evaluate((span) => {
      const range = document.createRange();
      range.selectNodeContents(span);
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(range);
      document.dispatchEvent(new Event("selectionchange"));
    });
  await expect(page.getByRole("toolbar", { name: "Selection actions" })).toBeVisible();
  await page.getByRole("button", { name: "Highlight and add note" }).click();
  const note = page.getByRole("dialog", { name: "Add note" });
  await note.getByPlaceholder("Write a note (optional)…").fill("A reusable reading detail.");
  await note.getByRole("button", { name: "Save", exact: true }).click();
  await expect(layer.locator("mark.annotation-highlight")).toHaveText(
    "Portable reading second page"
  );
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("verto:annotations") ?? ""))
    .toContain("A reusable reading detail.");
  const annotations = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("verto:annotations")!).annotations as { docSlug: string }[]
  );
  expect(annotations.map((annotation) => annotation.docSlug).sort()).toEqual([
    `files/${id}/page-1`,
    `files/${id}/page-2`,
  ]);
  await page.reload();
  await expect(layer).toContainText("Portable reading second page");
  await expect(layer.locator("mark.annotation-highlight")).toHaveText(
    "Portable reading second page"
  );
  await page.getByRole("button", { name: "Previous page", exact: true }).click();
  await expect(layer.locator("mark.annotation-highlight")).toHaveText("Research notebook");
});
