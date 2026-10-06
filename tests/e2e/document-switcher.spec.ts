import { expect, test, type Page } from "playwright/test";
import { savedScrollPosition, seedRelatedArticles } from "./helpers/related-document-fixture";
import type { BrowserArticle } from "@/lib/browser-articles";

const CURRENT = "# Field notes\n\nOriginal words stay intact.\n";
const NEXT = "# Next article\n\nA separate document.\n";
const UNSAVED = "# Field notes\n\nKeep this unfinished alternative.\n";
const source = (page: Page) => page.getByRole("combobox", { name: /(?:MDX|Markdown) source/ });
const trigger = (page: Page) => page.getByRole("button", { name: "Switch document", exact: true });
const picker = (page: Page) => page.getByRole("dialog", { name: "Switch document", exact: true });
const query = (page: Page) => picker(page).getByRole("combobox", { name: "Search documents" });
const navigationToggle = (page: Page) =>
  page.getByRole("button", { name: "Toggle document navigation" });

async function seedArticles(page: Page) {
  await page.goto("/library");
  await expect(page.getByLabel("Import EPUB or PDF file")).toBeAttached();
  await page.evaluate(
    async ({ current, next }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("verto.articles");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction("articles", "readwrite");
          const records = [
            { id: "switch-current", filename: "field-notes.md", source: current },
            { id: "switch-next", filename: "next-article.md", source: next },
            {
              id: "switch-notebook",
              filename: "research.md",
              source: "# Research notebook\n\nA parent page.\n",
            },
            {
              id: "switch-draft",
              filename: "question-draft.md",
              source: "# Open questions\n\nAn unfinished thought.\n",
              parentId: "switch-notebook",
              status: "draft",
            },
          ];
          records.forEach((record, index) => {
            transaction.objectStore("articles").put({
              createdAt: "2026-10-02T01:00:00.000Z",
              updatedAt: new Date(Date.UTC(2026, 9, 3 + index)).toISOString(),
              revision: 1,
              status: "saved",
              ...record,
            });
          });
          transaction.oncomplete = () => resolve();
          transaction.onerror = transaction.onabort = () => reject(transaction.error);
        });
      } finally {
        database.close();
      }
    },
    { current: CURRENT, next: NEXT }
  );
}

async function storedArticles(page: Page): Promise<BrowserArticle[]> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("verto.articles");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise<BrowserArticle[]>((resolve, reject) => {
        const transaction = database.transaction("articles", "readonly");
        const request = transaction.objectStore("articles").getAll();
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      database.close();
    }
  });
}

async function openPicker(page: Page) {
  await trigger(page).click();
  await expect(picker(page)).toBeVisible();
  await expect(query(page)).toBeFocused();
}

async function chooseDocument(page: Page, title: string) {
  await openPicker(page);
  await query(page).fill(title);
  await picker(page).getByRole("option", { name: title, exact: true }).click();
}

async function rejectDocumentSwitch(page: Page) {
  await openPicker(page);
  await query(page).fill("Next article");
  let prompted = false;
  page.once("dialog", async (dialog) => {
    prompted = true;
    await dialog.dismiss();
  });
  await picker(page).getByRole("option", { name: "Next article", exact: true }).click();
  expect(prompted).toBe(true);
  await expect(page).toHaveURL("/editor?document=switch-current");
  await expect(picker(page)).toBeVisible();
  await expect(query(page)).toHaveValue("Next article");
  await expect(query(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger(page)).toBeFocused();
}

for (const width of [320, 1280]) {
  test(`switches from real visits and searches drafts and paths without writing documents at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    let inferenceRequests = 0;
    await page.route("https://models.github.ai/**", (route) => {
      inferenceRequests++;
      return route.abort();
    });
    await seedArticles(page);
    for (const [id, title] of [
      ["switch-next", "Next article"],
      ["switch-current", "Field notes"],
    ]) {
      await page.goto(`/read/local?document=${id}`);
      await expect(page.locator("[data-article]")).toBeVisible();
      await openPicker(page);
      await expect(
        picker(page).getByRole("group", { name: "Recent", exact: true }).getByRole("option", {
          name: title,
          exact: true,
        })
      ).toHaveAttribute("aria-current", "page");
      await page.keyboard.press("Escape");
    }
    const baseline = await storedArticles(page);
    await openPicker(page);
    await expect(picker(page).getByText("Recent", { exact: true })).toBeVisible();
    const titles = await picker(page)
      .getByRole("option")
      .evaluateAll((options) => options.map((option) => option.getAttribute("aria-label")));
    expect(titles.indexOf("Field notes")).toBeGreaterThanOrEqual(0);
    expect(titles.indexOf("Next article")).toBeGreaterThan(titles.indexOf("Field notes"));
    await expect(
      picker(page).getByRole("option", { name: "Field notes", exact: true })
    ).toHaveAttribute("aria-current", "page");
    const bounds = (await picker(page).boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await query(page).fill("question-draft.md");
    const draft = picker(page).getByRole("option", { name: "Open questions", exact: true });
    await expect(draft).toBeVisible();
    await expect(draft).toContainText("Draft");
    await expect(draft).toContainText("question-draft.md");
    await query(page).fill("Research notebook");
    await expect(draft).toBeVisible();
    await query(page).fill("no-document-matches-this");
    await expect(picker(page).getByRole("option")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(picker(page)).toBeHidden();
    await expect(trigger(page)).toBeFocused();
    await expect(page).toHaveURL("/read/local?document=switch-current");
    await expect(page.locator("[data-article]")).toContainText("Original words stay intact.");
    await openPicker(page);
    await query(page).fill("Next article");
    for (const composing of [true, false]) {
      await query(page).evaluate((input, isComposing) => {
        input.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            bubbles: true,
            cancelable: true,
            isComposing,
            keyCode: isComposing ? 13 : 229,
          })
        );
      }, composing);
      await expect(page).toHaveURL("/read/local?document=switch-current");
      await expect(picker(page)).toBeVisible();
      await expect(query(page)).toHaveValue("Next article");
      await expect(query(page)).toBeFocused();
    }
    await query(page).press("ArrowDown");
    await expect(query(page)).toBeFocused();
    await query(page).press("Enter");
    await expect(page).toHaveURL("/read/local?document=switch-next");
    await expect(picker(page)).toBeHidden();
    await expect(page.locator("[data-article]")).toContainText("A separate document.");
    await expect(navigationToggle(page)).toHaveAttribute("aria-expanded", "false");
    expect(await storedArticles(page)).toEqual(baseline);
    expect(inferenceRequests).toBe(0);
  });
}

test("switches related long Reader documents and restores history and reading position without rewriting them", async ({
  page,
  baseURL,
}) => {
  const target = new URL(baseURL!);
  target.hostname = "127.0.0.1";
  const origin = target.origin;
  const currentHref = "/read/local?document=qa-current";
  const siblingHref = "/read/local?document=qa-sibling";
  await page.setViewportSize({ width: 768, height: 800 });
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  let inferenceRequests = 0;
  await page.route(/https:\/\/(?:models\.github\.ai|api\.openai\.com)\//, (route) => {
    inferenceRequests++;
    return route.abort();
  });
  await page.route(`${origin}/qa-document-switching.svg`, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="360"><rect width="1400" height="360" fill="#99aab6"/></svg>',
    })
  );
  await seedRelatedArticles(page, origin);
  await page.goto(`${origin}${siblingHref}`);
  await expect(page.locator("[data-article]")).toContainText("Keep the original words intact.");
  await page.goto(`${origin}${currentHref}`);
  const article = page.locator("[data-article]");
  const scroller = page.locator("[data-page-scroll]");
  await expect(article).toContainText("Passage 15 · 途中笔记");
  await expect.poll(() => savedScrollPosition(page, currentHref)).toBe(0);
  await expect
    .poll(() =>
      article
        .getByRole("img", { name: "Quiet horizon" })
        .evaluate(
          (image) =>
            (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0
        )
    )
    .toBe(true);
  const baseline = await storedArticles(page);
  await expect(navigationToggle(page)).toHaveAttribute("aria-expanded", "false");
  await scroller.hover();
  await page.mouse.wheel(0, 480);
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(450);
  const position = await scroller.evaluate((element) => element.scrollTop);
  expect(position).toBeLessThan(510);
  await expect.poll(() => savedScrollPosition(page, currentHref)).toBe(position);
  await openPicker(page);
  await query(page).fill("question-draft.md");
  await expect(
    picker(page).getByRole("option", { name: "Open questions", exact: true })
  ).toBeVisible();
  await query(page).fill("no-document-matches-this");
  await expect(picker(page).getByRole("option")).toHaveCount(0);
  for (let reopen = 0; reopen < 3; reopen++) {
    await page.keyboard.press("Escape");
    await expect(trigger(page)).toBeFocused();
    await openPicker(page);
  }
  await query(page).fill("Field notes");
  const sibling = picker(page).getByRole("option", { name: "Field notes", exact: true });
  await expect(picker(page).getByRole("option")).toHaveCount(1);
  await expect(sibling).toHaveAttribute("href", siblingHref);
  await query(page).press("ArrowDown");
  await expect(query(page)).toHaveAttribute(
    "aria-activedescendant",
    (await sibling.getAttribute("id")) as string
  );
  await query(page).press("Enter");
  await expect(page).toHaveURL(`${origin}${siblingHref}`);
  await expect(picker(page)).toBeHidden();
  await expect(article).toContainText("Keep the original words intact.");
  await expect(navigationToggle(page)).toHaveAttribute("aria-expanded", "false");
  await page.goBack();
  await expect(page).toHaveURL(`${origin}${currentHref}`);
  await expect(article).toContainText("Passage 15 · 途中笔记");
  await expect
    .poll(async () =>
      Math.abs((await scroller.evaluate((element) => element.scrollTop)) - position)
    )
    .toBeLessThanOrEqual(2);
  await expect(navigationToggle(page)).toHaveAttribute("aria-expanded", "false");
  await page.goForward();
  await expect(page).toHaveURL(`${origin}${siblingHref}`);
  await expect(article).toContainText("Keep the original words intact.");
  await expect(navigationToggle(page)).toHaveAttribute("aria-expanded", "false");
  expect(await storedArticles(page)).toEqual(baseline);
  expect(inferenceRequests).toBe(0);
});

test("keeps Preview or Source and the explicit structure preference while switching documents", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedArticles(page);
  await page.goto("/editor?document=switch-current");
  await expect(source(page)).toHaveValue(CURRENT);
  const baseline = await storedArticles(page);
  await expect(navigationToggle(page)).toHaveAttribute("aria-expanded", "false");
  await navigationToggle(page).click();
  const structure = page.getByRole("complementary", { name: "Document navigation" });
  await expect(structure.getByRole("link", { name: "Next article", exact: true })).toHaveCount(0);
  await expect(structure.getByRole("link", { name: "Field notes", exact: true })).toBeVisible();
  await expect(
    structure.getByRole("link", { name: "Browse library", exact: true })
  ).toHaveAttribute("href", "/library");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await chooseDocument(page, "Next article");
  await expect(page).toHaveURL("/editor?document=switch-next");
  await expect(page.getByRole("button", { name: "Preview", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.locator("[data-editor-preview]")).toContainText("A separate document.");
  await expect(navigationToggle(page)).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(source(page)).toHaveValue(NEXT);
  await navigationToggle(page).click();
  await chooseDocument(page, "Field notes");
  await expect(page).toHaveURL("/editor?document=switch-current");
  await expect(source(page)).toHaveValue(CURRENT);
  await expect(page.getByRole("button", { name: "Source", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(navigationToggle(page)).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(navigationToggle(page)).toHaveAttribute("aria-expanded", "false");
  await chooseDocument(page, "Open questions");
  await expect(page).toHaveURL("/editor?document=switch-draft");
  await expect(page.getByRole("button", { name: "Preview", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.locator("[data-editor-preview]")).toContainText("An unfinished thought.");
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(source(page)).toHaveValue("# Open questions\n\nAn unfinished thought.\n");
  expect(await storedArticles(page)).toEqual(baseline);
});

test("retains the picker query, Preview and unsaved or conflicting text when leaving is cancelled", async ({
  page,
  context,
}) => {
  await seedArticles(page);
  await page.goto("/editor?document=switch-current");
  await expect(source(page)).toHaveValue(CURRENT);
  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === "articles" && value.id === "switch-current") {
        throw new DOMException("The device is full.", "QuotaExceededError");
      }
      return key === undefined ? originalPut.call(this, value) : originalPut.call(this, value, key);
    };
  });
  await source(page).fill(UNSAVED);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("The device is full.");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await rejectDocumentSwitch(page);
  await expect(page.getByRole("button", { name: "Preview", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.locator("[data-editor-preview]")).toContainText(
    "Keep this unfinished alternative."
  );
  expect(
    (await storedArticles(page)).find((article) => article.id === "switch-current")?.source
  ).toBe(CURRENT);
  const other = await context.newPage();
  await other.goto("/editor?document=switch-current");
  await expect(source(other)).toHaveValue(CURRENT);
  await source(other).fill("# Field notes\n\nSaved in another window.\n");
  await expect(
    other.getByRole("status").filter({ hasText: "Saved in this browser" })
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("another window");
  await rejectDocumentSwitch(page);
  await expect(page.locator("[data-editor-preview]")).toContainText(
    "Keep this unfinished alternative."
  );
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expect(source(page)).toHaveValue(UNSAVED);
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  expect(
    (await storedArticles(page)).find((article) => article.id === "switch-current")?.source
  ).toBe("# Field notes\n\nSaved in another window.\n");
  await other.close();
});
