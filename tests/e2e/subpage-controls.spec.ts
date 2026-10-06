import { expect, test, type Locator, type Page } from "playwright/test";

const TITLE = "Reading control notes";
const LONG_ARTICLE = `# ${TITLE}\n\n${Array.from(
  { length: 24 },
  (_, index) =>
    `Passage ${index + 1} connects the original source with a useful reading note. ` +
    "Keep the evidence beside the document so a reader can return to the same thought after navigating."
).join("\n\n")}\n`;
const EDITOR_ARTICLE = "# Field notes\n\nA selected passage.\n";
const sourceInput = (page: Page) => page.getByRole("combobox", { name: /(?:MDX|Markdown) source/ });
const selectionToolbar = (page: Page) => page.getByRole("toolbar", { name: "Selection actions" });
type SelectionBox = { x: number; y: number; width: number; height: number };

async function createArticle(page: Page, source: string) {
  await page.goto("/editor");
  await expect(sourceInput(page)).toBeEditable();
  await page.getByRole("textbox", { name: "Filename" }).fill("reading-controls.mdx");
  await sourceInput(page).fill(source);
  await expect(page).toHaveURL(/\/editor\?document=/);
  await expect(page.getByRole("status").filter({ hasText: "Saved in this browser" })).toBeVisible();
  return new URL(page.url()).searchParams.get("document")!;
}

async function selectParagraph(paragraph: Locator): Promise<SelectionBox> {
  return paragraph.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    const rects = range.getClientRects();
    const last = rects[rects.length - 1];
    return { x: last.left, y: last.top, width: last.width, height: last.height };
  });
}

async function currentSelectionBox(page: Page): Promise<SelectionBox> {
  return page.evaluate(() => {
    const rects = window.getSelection()!.getRangeAt(0).getClientRects();
    const last = rects[rects.length - 1];
    return { x: last.left, y: last.top, width: last.width, height: last.height };
  });
}

async function paragraphEndBox(paragraph: Locator): Promise<SelectionBox> {
  return paragraph.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const rects = range.getClientRects();
    const last = rects[rects.length - 1];
    return { x: last.left, y: last.top, width: last.width, height: last.height };
  });
}

async function markedPassageBox(paragraph: Locator): Promise<SelectionBox> {
  return paragraph.evaluate((element) => {
    const marks = Array.from(element.querySelectorAll("mark.annotation-highlight"));
    const rects = marks.map((item) => item.getBoundingClientRect());
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return { x: left, y: top, width: right - left, height: bottom - top };
  });
}

async function expectInViewport(page: Page, locator: Locator) {
  const viewport = page.viewportSize()!;
  await expect(locator).toBeVisible();
  await expect
    .poll(async () => {
      const box = (await locator.boundingBox())!;
      return Math.max(
        -box.x,
        -box.y,
        box.x + box.width - viewport.width - 1,
        box.y + box.height - viewport.height - 1
      );
    })
    .toBeLessThanOrEqual(0);
}

async function expectToolbarAtPassage(page: Page, selection: SelectionBox) {
  const toolbar = selectionToolbar(page);
  await expectInViewport(page, toolbar);
  await expect
    .poll(async () => {
      const box = (await toolbar.boundingBox())!;
      return Math.min(
        Math.abs(box.y + box.height - selection.y),
        Math.abs(box.y - selection.y - selection.height)
      );
    })
    .toBeLessThanOrEqual(18);
  const box = (await toolbar.boundingBox())!;
  expect(box.y + box.height <= selection.y + 1 || box.y >= selection.y + selection.height - 1).toBe(
    true
  );
  const center = selection.x + selection.width / 2;
  expect(box.x).toBeLessThanOrEqual(center);
  expect(box.x + box.width).toBeGreaterThanOrEqual(center);
}

async function expectBelowPassage(page: Page, dialog: Locator, selection: SelectionBox) {
  await expectInViewport(page, dialog);
  await expect
    .poll(async () => Math.abs((await dialog.boundingBox())!.y - selection.y - selection.height))
    .toBeLessThanOrEqual(18);
  const box = (await dialog.boundingBox())!;
  const center = selection.x + selection.width / 2;
  expect(box.x).toBeLessThanOrEqual(center);
  expect(box.x + box.width).toBeGreaterThanOrEqual(center);
}

test("anchors annotation controls to the passage after article scrolling and navigation collapse", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const id = await createArticle(page, LONG_ARTICLE);
  await page.goto(`/read/local?document=${id}`);
  await expect(page.getByRole("heading", { name: TITLE, exact: true })).toBeVisible();
  const toggle = page.getByRole("button", { name: "Toggle document navigation" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const paragraphs = page.locator("[data-article] p");
  await expectToolbarAtPassage(page, await selectParagraph(paragraphs.first()));

  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  const passage = paragraphs.nth(8);
  await passage.evaluate((element) => element.scrollIntoView({ block: "center" }));
  expect(
    await page.locator("[data-page-scroll]").evaluate((element) => element.scrollTop)
  ).toBeGreaterThan(200);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expectToolbarAtPassage(page, await selectParagraph(passage));
  await page.locator("[data-page-scroll]").evaluate((element) => {
    element.scrollTop += 40;
  });
  await expectToolbarAtPassage(page, await currentSelectionBox(page));
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  const selected = await selectParagraph(passage);
  await expectToolbarAtPassage(page, selected);

  await selectionToolbar(page).getByRole("button", { name: "Highlight and add note" }).click();
  const composer = page.getByRole("dialog", { name: "Add note" });
  await expectBelowPassage(page, composer, selected);
  await composer.getByPlaceholder("Write a note (optional)…").fill("Keep this source nearby.");
  await page.locator("[data-page-scroll]").evaluate((element) => {
    element.scrollTop += 16;
  });
  await expectBelowPassage(page, composer, await paragraphEndBox(passage));
  await expect(composer.getByPlaceholder("Write a note (optional)…")).toHaveValue(
    "Keep this source nearby."
  );
  await composer.getByRole("button", { name: "Save", exact: true }).click();
  await expect(composer).toBeHidden();
  const mark = passage.locator("mark.annotation-highlight").first();
  await expect(mark).toBeVisible();
  await mark.click();
  const popover = page.getByRole("dialog", { name: "Highlight", exact: true });
  await expectBelowPassage(page, popover, await markedPassageBox(passage));
  await expect(popover).toContainText("Keep this source nearby.");
  await popover.getByRole("button", { name: "Edit", exact: true }).click();
  await popover
    .getByPlaceholder("Write a note (optional)…")
    .fill("Keep this updated thought nearby.");
  await page.locator("[data-page-scroll]").evaluate((element) => {
    element.scrollTop += 16;
  });
  await expectBelowPassage(page, popover, await markedPassageBox(passage));
  await expect(popover.getByPlaceholder("Write a note (optional)…")).toHaveValue(
    "Keep this updated thought nearby."
  );
  await popover.getByRole("button", { name: "Save", exact: true }).click();
  await expect(popover).toContainText("Keep this updated thought nearby.");
  await popover.getByRole("radio", { name: "Blue", exact: true }).click();
  await expect(mark).toHaveAttribute("data-color", "blue");
  await popover.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(passage.locator("mark.annotation-highlight")).toHaveCount(0);
});

test("keeps mobile Reader selection actions inside the viewport with usable touch targets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const id = await createArticle(page, LONG_ARTICLE);
  await page.goto(`/read/local?document=${id}`);
  await expect(page.getByRole("heading", { name: TITLE, exact: true })).toBeVisible();
  const passage = page.locator("[data-article] p").nth(3);
  await passage.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await selectParagraph(passage);
  const toolbar = selectionToolbar(page);
  await expectInViewport(page, toolbar);
  const controls = toolbar.locator("button");
  expect(await controls.count()).toBeGreaterThanOrEqual(8);
  for (const control of await controls.all()) {
    await expectInViewport(page, control);
    const box = (await control.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await toolbar.getByRole("button", { name: "Highlight in Blue", exact: true }).click();
  await expect(passage.locator("mark.annotation-highlight").first()).toHaveAttribute(
    "data-color",
    "blue"
  );
});

test("keeps mobile formatting inside the editor and preserves undo and keyboard view switching", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await createArticle(page, EDITOR_ARTICLE);
  const source = sourceInput(page);
  await source.focus();
  await source.evaluate((element: HTMLTextAreaElement) => {
    const start = element.value.indexOf("selected passage");
    element.setSelectionRange(start, start + "selected passage".length);
    element.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await source.press("Shift");
  const toolbar = page.getByRole("toolbar", { name: "Text formatting" });
  await expectInViewport(page, toolbar);
  const pane = (await source.boundingBox())!;
  const group = toolbar.getByRole("group", { name: "Markdown formatting" });
  const groupBox = (await group.boundingBox())!;
  expect(groupBox.x).toBeGreaterThanOrEqual(pane.x);
  expect(groupBox.x + groupBox.width).toBeLessThanOrEqual(pane.x + pane.width + 1);
  for (const control of await toolbar.getByRole("button").all()) {
    await expectInViewport(page, control);
    const box = (await control.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(pane.x);
    expect(box.x + box.width).toBeLessThanOrEqual(pane.x + pane.width + 1);
  }
  await group.getByRole("button", { name: "Bold", exact: true }).click();
  await expect(source).toHaveValue("# Field notes\n\nA **selected passage**.\n");
  await source.press("Control+z");
  await expect(source).toHaveValue(EDITOR_ARTICLE);
  const views = page.getByRole("group", { name: "Document view" });
  const sourceView = views.getByRole("button", { name: "Source", exact: true });
  const previewView = views.getByRole("button", { name: "Preview", exact: true });
  await sourceView.focus();
  await sourceView.press("ArrowRight");
  await expect(previewView).toBeFocused();
  await expect(previewView).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-editor-preview]")).toContainText("A selected passage.");
  await previewView.press("ArrowLeft");
  await expect(sourceView).toBeFocused();
  await expect(sourceView).toHaveAttribute("aria-pressed", "true");
  await expect(sourceInput(page)).toHaveValue(EDITOR_ARTICLE);
});

test("keeps lower-edge note drafts and long highlight notes reachable on a small viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const id = await createArticle(page, LONG_ARTICLE);
  await page.goto(`/read/local?document=${id}`);
  await expect(page.getByRole("heading", { name: TITLE, exact: true })).toBeVisible();
  const passage = page.locator("[data-article] p").nth(5);
  await passage.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const rects = range.getClientRects();
    const last = rects[rects.length - 1];
    const scroll = element.closest<HTMLElement>("[data-page-scroll]")!;
    scroll.scrollTop += last.bottom - (window.innerHeight - 24);
  });
  const selected = await selectParagraph(passage);
  expect(selected.y + selected.height).toBeGreaterThanOrEqual(612);
  expect(selected.y + selected.height).toBeLessThanOrEqual(620);
  await selectionToolbar(page).getByRole("button", { name: "Highlight and add note" }).click();
  const composer = page.getByRole("dialog", { name: "Add note" });
  await expectInViewport(page, composer);
  const composerSave = composer.getByRole("button", { name: "Save", exact: true });
  await composerSave.scrollIntoViewIfNeeded();
  await expectInViewport(page, composerSave);
  const draft = "A lower-edge draft survives when its source scrolls away.";
  await composer.getByPlaceholder("Write a note (optional)…").fill(draft);
  await page.locator("[data-page-scroll]").evaluate((element) => {
    element.scrollTop += window.innerHeight;
  });
  await expect(passage).not.toBeInViewport();
  await expectInViewport(page, composer);
  await expect(composer.getByPlaceholder("Write a note (optional)…")).toHaveValue(draft);
  await composerSave.scrollIntoViewIfNeeded();
  await expectInViewport(page, composerSave);
  await composerSave.click();
  await expect(composer).toBeHidden();
  const mark = passage.locator("mark.annotation-highlight").first();
  await expect(mark).toBeAttached();
  const markPoint = await mark.evaluate((element) => {
    const scroll = element.closest<HTMLElement>("[data-page-scroll]")!;
    const range = document.createRange();
    range.selectNodeContents(element);
    const before = range.getClientRects();
    scroll.scrollTop += before[before.length - 1].bottom - (window.innerHeight - 24);
    const rects = range.getClientRects();
    const last = rects[rects.length - 1];
    return { x: last.left + last.width / 2, y: last.top + last.height / 2 };
  });
  await page.mouse.click(markPoint.x, markPoint.y);
  const popover = page.getByRole("dialog", { name: "Highlight", exact: true });
  await expectInViewport(page, popover);
  await expect(popover).toContainText(draft);
  const edit = popover.getByRole("button", { name: "Edit", exact: true });
  await edit.click();
  const longNote = Array.from(
    { length: 30 },
    (_, index) => `Reading detail ${index + 1}: keep this source and the thought together.`
  ).join("\n");
  await popover.getByPlaceholder("Write a note (optional)…").fill(longNote);
  await expectInViewport(page, popover);
  const popoverSave = popover.getByRole("button", { name: "Save", exact: true });
  await popoverSave.scrollIntoViewIfNeeded();
  await expectInViewport(page, popoverSave);
  await popoverSave.click();
  await expect(popover).toContainText("Reading detail 30");
  await expectInViewport(page, popover);
  expect(await popover.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
    true
  );
  await edit.scrollIntoViewIfNeeded();
  await expectInViewport(page, edit);
  await edit.click();
  await page.locator("[data-page-scroll]").evaluate((element) => {
    element.scrollTop += window.innerHeight;
  });
  await expect(passage).not.toBeInViewport();
  await expect(popover.getByPlaceholder("Write a note (optional)…")).toHaveValue(longNote);
  await expectInViewport(page, popover);
  await popoverSave.scrollIntoViewIfNeeded();
  await expectInViewport(page, popoverSave);
  await popoverSave.click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem("verto:annotations") ?? "{}");
        return stored.annotations?.flatMap((annotation: { turns: { body: string }[] }) =>
          annotation.turns.map((turn) => turn.body)
        );
      })
    )
    .toContain(longNote);
});
