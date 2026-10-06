import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "playwright/test";

const ARTICLE =
  "# Field notes\n\nAn article written in this browser.\n\n## Observations\n\nKeep the document portable.\n";
const sourceInput = (page: Page) => page.getByRole("combobox", { name: /(?:MDX|Markdown) source/ });
const saved = (page: Page) => page.getByRole("status").filter({ hasText: "Saved in this browser" });

test("keeps narrow navigation clear of breadcrumbs and persists a chosen highlight color", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  const id = await createArticle(page);
  await page.goto(`/read/local?document=${id}`);
  await expect(page.getByRole("heading", { name: "Field notes", level: 1 })).toBeVisible();
  const toggle = page.getByRole("button", { name: "Toggle document navigation" });
  const notes = page.getByRole("navigation", { name: "Page hierarchy" }).getByRole("link", {
    name: "Notes",
    exact: true,
  });
  const toggleBox = (await toggle.boundingBox())!;
  const notesBox = (await notes.boundingBox())!;
  expect(toggleBox.y + toggleBox.height).toBeLessThanOrEqual(notesBox.y);
  const passage = page.locator("[data-article] p").first();
  await passage.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await page
    .getByRole("toolbar", { name: "Selection actions" })
    .getByRole("button", {
      name: "Highlight in Blue",
      exact: true,
    })
    .click();
  const mark = page.locator("[data-article] mark.annotation-highlight");
  await expect(mark).toHaveText("An article written in this browser.");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const records = JSON.parse(localStorage.getItem("verto:annotations") ?? "{}");
        return records.annotations?.find(
          (annotation: { quote: string; color: string }) =>
            annotation.quote === "An article written in this browser."
        )?.color;
      })
    )
    .toBe("blue");
  await page.reload();
  await expect(mark).toHaveText("An article written in this browser.");
  await expect(mark).toHaveAttribute("data-color", "blue");
});

async function createArticle(page: Page, source = ARTICLE, filename = "field-notes.mdx") {
  await page.goto("/editor");
  await expect(sourceInput(page)).toBeEditable();
  await page.getByRole("textbox", { name: "Filename" }).fill(filename);
  await sourceInput(page).fill(source);
  await expect(page).toHaveURL(/\/editor\?document=/);
  await expect(saved(page)).toBeVisible();
  return new URL(page.url()).searchParams.get("document")!;
}

test("autosaves a draft, recovers after refresh, and saves a readable article in Notes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const id = await createArticle(page);
  await page.reload();
  await expect(sourceInput(page)).toHaveValue(ARTICLE);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(saved(page)).toBeVisible();
  await page.goto("/library?view=notes");
  await expect(page.getByRole("heading", { name: "Notes", exact: true })).toBeVisible();
  const article = page.getByRole("link", { name: /^Field notes\.mdx/ });
  await expect(article).toHaveAttribute("href", `/read/local?document=${id}`);
  await article.click();
  await expect(page.getByRole("heading", { name: "Field notes", level: 1 })).toHaveCount(1);
  await expect(page.locator("[data-article]")).toContainText("Keep the document portable.");
  await page
    .locator("summary:visible")
    .filter({ hasText: /^On this page$/ })
    .click();
  await expect(page.getByRole("link", { name: "Observations", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Edit Field notes", exact: true }).click();
  await expect(page).toHaveURL(`/editor?document=${id}`);
  await expect(sourceInput(page)).toHaveValue(ARTICLE);
});

test("keeps autosaved drafts separate from saved Notes and exports exact Markdown", async ({
  page,
}) => {
  const id = await createArticle(page, ARTICLE, "field-notes.md");
  const exportPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await exportPromise;
  expect(download.suggestedFilename()).toBe("field-notes.md");
  expect(await readFile((await download.path())!, "utf8")).toBe(ARTICLE);
  await page.goto("/library?view=notes");
  await expect(page.getByRole("link", { name: /^Field notes\.md/ })).toHaveCount(0);
  await page.getByRole("tab", { name: /Drafts/ }).click();
  await expect(page.getByRole("link", { name: /^Field notes\.md/ })).toHaveAttribute(
    "href",
    `/read/local?document=${id}`
  );
});

test("retains the losing window's text until an explicit conflict recovery", async ({
  page,
  context,
}) => {
  const id = await createArticle(page);
  const other = await context.newPage();
  await other.goto(`/editor?document=${id}`);
  await expect(sourceInput(other)).toHaveValue(ARTICLE);
  await sourceInput(page).fill("# Field notes\n\nThe first window’s saved update.\n");
  await expect(saved(page)).toBeVisible();
  await expect(other.getByRole("main").getByRole("alert")).toContainText("another window");
  await expect(sourceInput(other)).toHaveValue(ARTICLE);
  await sourceInput(other).fill("# My retained alternative\n");
  await expect(other.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  await other.getByRole("button", { name: "Load saved version" }).click();
  await expect(sourceInput(other)).toHaveValue(
    "# Field notes\n\nThe first window’s saved update.\n"
  );
  await other.close();
});

test("edits a configured source as one browser copy while preserving its original", async ({
  page,
}) => {
  await page.goto("/editor?slug=demo");
  await expect(sourceInput(page)).toHaveValue(/# Verto Feature Demo/);
  const original = await sourceInput(page).inputValue();
  await sourceInput(page).fill(`${original}\nLocal browser annotation.\n`);
  await expect(page).toHaveURL(/\/editor\?document=/);
  await expect(saved(page)).toBeVisible();
  const id = new URL(page.url()).searchParams.get("document");
  await page.goto("/editor?slug=demo");
  await expect(page).toHaveURL(`/editor?document=${id}`);
  await expect(sourceInput(page)).toHaveValue(`${original}\nLocal browser annotation.\n`);
  await page.goto("/read/demo");
  await expect(page.locator("[data-article]")).not.toContainText("Local browser annotation.");
});

test("formatting keeps native undo and selected-passage AI requires review", async ({ page }) => {
  await createArticle(page, "# Field notes\n\nA selected passage.\n");
  const source = sourceInput(page);
  await source.focus();
  await source.evaluate((element: HTMLTextAreaElement) => {
    const start = element.value.indexOf("selected passage");
    element.setSelectionRange(start, start + "selected passage".length);
    element.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await source.press("Shift");
  const toolbar = page.getByRole("toolbar", { name: "Text formatting" });
  await expect(toolbar).toBeVisible();
  await toolbar.getByRole("button", { name: "Bold", exact: true }).click();
  await expect(source).toHaveValue("# Field notes\n\nA **selected passage**.\n");
  await source.press("Control+z");
  await expect(source).toHaveValue("# Field notes\n\nA selected passage.\n");
  await source.evaluate((element: HTMLTextAreaElement) => {
    const start = element.value.indexOf("selected passage");
    element.setSelectionRange(start, start + "selected passage".length);
    element.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await source.press("Shift");
  await toolbar.getByRole("button", { name: "Ask AI about selected text" }).click();
  await expect(page.getByRole("textbox", { name: "What should change?" })).toHaveValue(
    /selected passage/
  );
  await expect(source).toHaveValue("# Field notes\n\nA selected passage.\n");
});

test("a storage failure retains editable text and a portable export", async ({ page }) => {
  await page.addInitScript(() => {
    window.indexedDB.open = () => {
      throw new DOMException("Storage is unavailable", "SecurityError");
    };
  });
  await page.goto("/editor");
  await sourceInput(page).fill(ARTICLE);
  await expect(
    page.getByRole("main").getByRole("alert").filter({ hasText: "Could not save this article." })
  ).toContainText("Could not save this article. Storage is unavailable");
  await expect(sourceInput(page)).toHaveValue(ARTICLE);
  await expect(sourceInput(page)).toBeEditable();
  const retainedSource = `${ARTICLE}\nFurther edits remain available after the failed save.\n`;
  await sourceInput(page).fill(retainedSource);
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(
    page.getByRole("main").getByRole("alert").filter({ hasText: "Could not save this article." })
  ).toContainText("Could not save this article. Storage is unavailable");
  await expect(sourceInput(page)).toHaveValue(retainedSource);
  expect(new URL(page.url()).searchParams.has("document")).toBe(false);
  const exportPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await exportPromise;
  expect(await readFile((await download.path())!, "utf8")).toBe(retainedSource);
  await expect(saved(page)).toHaveCount(0);
});

test("opens and edits an existing browser article without a source API", async ({ page }) => {
  const id = await createArticle(page);
  await page.route("**/api/editor**", (route) => route.abort());
  await page.goto(`/read/local?document=${id}`);
  await expect(page.locator("[data-article]")).toContainText("Keep the document portable.");
  await page.getByRole("link", { name: "Edit Field notes", exact: true }).click();
  await expect(sourceInput(page)).toHaveValue(ARTICLE);
});

test("a missing article gives a recovery route instead of an empty draft", async ({ page }) => {
  await page.goto("/read/local?document=missing-article");
  await expect(
    page.getByRole("heading", { name: "This article isn’t in this browser" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to library" })).toHaveAttribute(
    "href",
    "/library"
  );
  await page.goto("/editor?document=missing-article");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("removed");
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
});

test("switches between browser article tabs without losing their document query", async ({
  page,
}) => {
  const first = await createArticle(page);
  await page.goto(`/read/local?document=${first}`);
  await expect(page.getByRole("heading", { name: "Field notes", level: 1 })).toBeVisible();
  const second = await createArticle(
    page,
    "# Another article\n\nA separate source.\n",
    "another.mdx"
  );
  await page.goto(`/read/local?document=${second}`);
  const tabs = page.getByRole("tablist", { name: "Open documents" });
  await expect(tabs.getByRole("tab", { name: "Another article" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await tabs.getByRole("tab", { name: "Field notes" }).click();
  await expect(page).toHaveURL(`/read/local?document=${first}`);
  await expect(page.locator("[data-article]")).toContainText("Keep the document portable.");
  await tabs.getByRole("tab", { name: "Another article" }).click();
  await expect(page).toHaveURL(`/read/local?document=${second}`);
  await expect(page.locator("[data-article]")).toContainText("A separate source.");
});

test("document tools have one owner and cancelled Library navigation keeps dirty text", async ({
  page,
}) => {
  const id = await createArticle(page);
  const sidebar = page.getByTestId("workspace-unified-panel");
  await expect(page.getByTestId("workspace-editor-panel")).toHaveCount(0);
  await expect(
    sidebar.getByRole("button", { name: /Show preview|Show source|Save article|Back to Library/ })
  ).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "Pages", exact: true })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Document navigation" })).toBeVisible();
  const views = page.getByRole("group", { name: "Document view" });
  await views.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.locator("[data-editor-preview]")).toContainText("Keep the document portable.");
  await views.getByRole("button", { name: "Source", exact: true }).click();
  await expect(sourceInput(page)).toHaveValue(ARTICLE);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(saved(page)).toBeVisible();
  await sourceInput(page).fill("# Keep this unfinished edit\n");
  let prompted = false;
  page.once("dialog", async (dialog) => {
    prompted = true;
    await dialog.dismiss();
  });
  await sidebar
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "Library", exact: true })
    .click();
  expect(prompted).toBe(true);
  await expect(page).toHaveURL(`/editor?document=${id}`);
  await expect(sourceInput(page)).toHaveValue("# Keep this unfinished edit\n");
});
