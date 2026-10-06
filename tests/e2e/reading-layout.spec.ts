import { expect, test, type Locator, type Page } from "playwright/test";

const TITLE =
  "从城市街道到公共图书馆：Reading across languages and returning to the original source";
const CJK = "阅读让我们把城市中遇见的细节与原始资料联系起来。".repeat(9);
const MIXED =
  "中英混排 keeps evidence close to the document, while a careful reader follows each idea without losing the original context. ".repeat(
    7
  );
const IMAGE_PATH = "/reading-layout-fixture.svg";
const ARTICLE = `# ${TITLE}\n\n${CJK}\n\n![A wide landscape](${IMAGE_PATH})\n\n## Evidence and interpretation\n\n${MIXED}\n`;
const source = (page: Page) => page.getByRole("combobox", { name: /(?:MDX|Markdown) source/ });
const toggle = (page: Page) => page.getByRole("button", { name: "Toggle document navigation" });
const navigation = (page: Page) => page.getByRole("complementary", { name: "Document navigation" });

async function createArticle(page: Page) {
  await page.route(`**${IMAGE_PATH}`, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="480" viewBox="0 0 1200 480"><rect width="1200" height="480" fill="#ccd7df"/><path d="M0 400 L350 100 L700 350 L1000 50 L1200 250 V480 H0Z" fill="#526b70"/></svg>',
    })
  );
  await page.goto("/editor");
  await expect(source(page)).toBeEditable();
  await page.getByRole("textbox", { name: "Filename" }).fill("reading-layout.md");
  await source(page).fill(ARTICLE);
  await expect(page).toHaveURL(/\/editor\?document=/);
  await expect(page.getByRole("status").filter({ hasText: "Saved in this browser" })).toBeVisible();
  return new URL(page.url()).searchParams.get("document")!;
}

async function expectNavigation(page: Page, open: boolean) {
  await expect(toggle(page)).toHaveAttribute("aria-expanded", String(open));
  if (open) await expect(navigation(page)).toBeVisible();
  else await expect(navigation(page)).toBeHidden();
}

async function expectBookmarkContentFits(button: Locator, labelVisible: boolean) {
  const label = button.locator(".doc-bookmark-label");
  if (labelVisible) await expect(label).toBeVisible();
  else await expect(label).toBeHidden();
  const bounds = await button.evaluate((element, showLabel) => {
    const content = element.querySelector(showLabel ? ".doc-bookmark-label" : "svg")!;
    const range = document.createRange();
    if (showLabel) range.selectNodeContents(content);
    const label = showLabel ? range.getBoundingClientRect() : content.getBoundingClientRect();
    const control = element.getBoundingClientRect();
    return {
      labelWidth: label.width,
      overflow: Math.max(
        control.left - label.left,
        label.right - control.right,
        control.top - label.top,
        label.bottom - control.bottom
      ),
    };
  }, labelVisible);
  expect(bounds.labelWidth).toBeGreaterThan(0);
  expect(bounds.overflow).toBeLessThanOrEqual(1);
  if (!labelVisible) {
    const control = (await button.boundingBox())!;
    expect(control.width).toBeGreaterThanOrEqual(44);
    expect(control.height).toBeGreaterThanOrEqual(44);
  }
}

async function measureContent(article: Locator, scroll: Locator, title: Locator) {
  const image = article.getByRole("img", { name: "A wide landscape", exact: true });
  await expect(image).toBeAttached();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1200);
  const bounds = (locator: Locator) =>
    locator.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        center: rect.left + rect.width / 2,
        width: rect.width,
        fontSize: Number.parseFloat(style.fontSize),
        lineHeight: Number.parseFloat(style.lineHeight),
        textAlign: style.textAlign,
        fits: element.scrollWidth <= element.clientWidth + 1,
      };
    });
  const viewport = await scroll.evaluate((element) => ({
    center: element.getBoundingClientRect().left + element.clientLeft + element.clientWidth / 2,
    fits: element.scrollWidth <= element.clientWidth + 1,
  }));
  return {
    image: await bounds(image),
    cjk: await bounds(article.getByText(CJK, { exact: true })),
    mixed: await bounds(article.getByText(MIXED.trim(), { exact: true })),
    title: await bounds(title),
    viewport,
  };
}

async function expectReadingColumn(
  article: Locator,
  scroll: Locator,
  title: Locator,
  width: number
) {
  const metrics = await measureContent(article, scroll, title);
  expect(metrics.viewport.fits).toBe(true);
  for (const element of [metrics.title, metrics.image, metrics.cjk, metrics.mixed]) {
    expect(Math.abs(element.center - metrics.viewport.center)).toBeLessThanOrEqual(2);
    expect(element.fits).toBe(true);
  }
  expect(metrics.title.textAlign).toBe("center");
  expect(metrics.title.fontSize).toBeGreaterThan(metrics.cjk.fontSize * 1.4);
  expect(metrics.cjk.fontSize).toBe(17);
  expect(metrics.cjk.lineHeight / metrics.cjk.fontSize).toBeCloseTo(1.7, 1);
  expect(metrics.cjk.width).toBeLessThanOrEqual(680);
  expect(metrics.mixed.width).toBeLessThanOrEqual(680);
  expect(metrics.cjk.width).toBeLessThanOrEqual(metrics.image.width + 1);
  if (width === 1280) {
    expect(metrics.image.width - metrics.cjk.width).toBeGreaterThan(100);
    expect(metrics.image.width - metrics.mixed.width).toBeGreaterThan(100);
  }
}

for (const width of [320, 768, 1280]) {
  test(`centers Reader and Preview content with long bilingual text and real media at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const id = await createArticle(page);
    await page.goto(`/read/local?document=${id}`);
    const readerArticle = page.locator("[data-article]");
    await expectNavigation(page, false);
    await expectReadingColumn(
      readerArticle,
      page.locator("[data-page-scroll]"),
      page.getByRole("heading", { name: TITLE, exact: true }),
      width
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width + 1
    );
    const bookmark = page.getByRole("button", { name: "Bookmark this document", exact: true });
    await expectBookmarkContentFits(bookmark, width > 700);
    await bookmark.click();
    const bookmarked = page.getByRole("button", { name: "Remove bookmark", exact: true });
    await expect(bookmarked).toHaveAttribute("aria-pressed", "true");
    await expectBookmarkContentFits(bookmarked, width > 700);
    await bookmarked.click();
    await expect(bookmark).toHaveAttribute("aria-pressed", "false");

    await page.goto(`/editor?document=${id}`);
    await expect(source(page)).toHaveValue(ARTICLE);
    await expectNavigation(page, width > 1050);
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expectNavigation(page, false);
    if (width === 320) {
      const navigationButton = (await toggle(page).boundingBox())!;
      expect(navigationButton.width).toBeGreaterThanOrEqual(44);
      expect(navigationButton.height).toBeGreaterThanOrEqual(44);
    }
    await expectReadingColumn(
      page.locator("[data-editor-preview]"),
      page.locator(".ed-preview-pane"),
      page.locator("[data-editor-document-heading] h1"),
      width
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width + 1
    );
    await page.getByRole("button", { name: "Source", exact: true }).click();
    await expect(source(page)).toHaveValue(ARTICLE);
  });
}

test("keeps Reader collapsed through resize and honors both explicit navigation choices", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/read/demo");
  await expect(page.locator("[data-article]")).toBeVisible();
  for (const width of [1280, 768, 320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNavigation(page, false);
  }
  await toggle(page).click();
  for (const width of [768, 320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNavigation(page, true);
  }
  await toggle(page).click();
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNavigation(page, false);
  }
});

test("lets Source and Preview choose defaults until the author explicitly chooses navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const id = await createArticle(page);
  await expectNavigation(page, true);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expectNavigation(page, false);
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expectNavigation(page, true);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await toggle(page).click();
  await expectNavigation(page, true);
  await page.setViewportSize({ width: 320, height: 900 });
  await expectNavigation(page, true);
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expectNavigation(page, true);
  await expect(source(page)).toHaveValue(ARTICLE);
  await toggle(page).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expectNavigation(page, false);
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expectNavigation(page, false);
  await page.getByRole("button", { name: "Source", exact: true }).click();
  await expectNavigation(page, false);
  await expect(source(page)).toHaveValue(ARTICLE);
  await expect(page).toHaveURL(`/editor?document=${id}`);
});

test("keeps Narrow and Full reading widths meaningful for the text and media columns", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const id = await createArticle(page);
  await page.goto(`/read/local?document=${id}`);
  const article = page.locator("[data-article]");
  const measure = () =>
    measureContent(
      article,
      page.locator("[data-page-scroll]"),
      page.getByRole("heading", { name: TITLE, exact: true })
    );
  const normal = await measure();
  for (const choice of ["Narrow", "Full"]) {
    await page.getByRole("button", { name: "Reading settings", exact: true }).click();
    await page
      .getByRole("radiogroup", { name: "Reading width" })
      .getByRole("radio", { name: choice, exact: true })
      .click();
    await page.keyboard.press("Escape");
    const metrics = await measure();
    if (choice === "Narrow") {
      expect(metrics.cjk.width).toBeLessThanOrEqual(640);
      expect(metrics.cjk.width).toBeLessThan(normal.cjk.width);
    } else {
      expect(metrics.cjk.width).toBeGreaterThan(normal.cjk.width);
      expect(metrics.cjk.width).toBeLessThanOrEqual(metrics.image.width + 1);
    }
    expect(Math.abs(metrics.cjk.center - metrics.viewport.center)).toBeLessThanOrEqual(2);
    expect(metrics.viewport.fits).toBe(true);
  }
});
