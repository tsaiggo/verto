import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "playwright/test";

const source = (page: Page) => page.getByRole("combobox", { name: /(?:MDX|Markdown) source/ });
const saved = (page: Page) => page.getByRole("status").filter({ hasText: "Saved in this browser" });
const localArticles = (page: Page) =>
  page
    .getByRole("complementary", { name: "Document navigation" })
    .getByRole("navigation", { name: "Local articles", exact: true });
const ORIGINAL =
  "---\ntitle: Research notebook\n---\n# Research notebook\n\nKeep the original source intact.\n";

async function createRoot(page: Page) {
  await page.goto("/editor");
  await expect(source(page)).toBeEditable();
  await page.getByRole("textbox", { name: "Filename" }).fill("notebook.mdx");
  await source(page).fill(ORIGINAL);
  await expect(page).toHaveURL(/\/editor\?document=/);
  await expect(saved(page)).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "New subpage", exact: true })).toBeEnabled();
  return new URL(page.url()).searchParams.get("document")!;
}

async function renamePage(page: Page, title: string) {
  await page.getByRole("button", { name: "Page actions", exact: true }).click();
  await page.getByRole("button", { name: "Rename page", exact: true }).click();
  await page.getByRole("textbox", { name: "Page title" }).fill(title);
  await page.getByRole("button", { name: "Rename page", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Page hierarchy" })).toContainText(title);
}

test("creates subpages with breadcrumbs and a matching document tree, preserving Markdown through rename", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const parentId = await createRoot(page);
  await page.getByRole("button", { name: "New subpage", exact: true }).click();
  await expect(page).not.toHaveURL(`/editor?document=${parentId}`);
  await expect(source(page)).toHaveValue("# Untitled\n\n");
  const childId = new URL(page.url()).searchParams.get("document")!;
  await expect(page.getByRole("navigation", { name: "Page hierarchy" })).toContainText(
    "Research notebook"
  );
  await renamePage(page, "Reading questions");
  await expect(source(page)).toHaveValue("# Untitled\n\n");
  await expect(page.getByRole("textbox", { name: "Filename" })).toHaveValue("untitled.mdx");
  await expect(page.getByRole("complementary", { name: "Document navigation" })).toBeHidden();
  await page.getByRole("button", { name: "Toggle document navigation" }).click();
  const pages = localArticles(page);
  await expect(pages.getByRole("link", { name: "Reading questions", exact: true })).toHaveAttribute(
    "href",
    `/editor?document=${childId}`
  );
  await expect(pages.getByRole("link", { name: "Reading questions", exact: true })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await pages.getByRole("button", { name: "Collapse Research notebook", exact: true }).click();
  await expect(pages.getByRole("link", { name: "Reading questions", exact: true })).toHaveCount(0);
  const search = page
    .getByRole("complementary", { name: "Document navigation" })
    .getByRole("searchbox", { name: "Search pages", exact: true });
  await search.fill("Reading questions");
  await expect(pages.getByRole("link", { name: "Research notebook", exact: true })).toBeVisible();
  await expect(pages.getByRole("link", { name: "Reading questions", exact: true })).toBeVisible();
  await expect(
    pages.getByRole("button", { name: "Collapse Research notebook", exact: true })
  ).toHaveAttribute("aria-expanded", "true");
  await expect(page).toHaveURL(`/editor?document=${childId}`);
  await expect(source(page)).toHaveValue("# Untitled\n\n");
  await search.fill("");
  await pages.getByRole("button", { name: "Collapse Research notebook", exact: true }).click();
  await pages.getByRole("button", { name: "Expand Research notebook", exact: true }).click();
  await expect(pages.getByRole("link", { name: "Reading questions", exact: true })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Page hierarchy" })
    .getByRole("link", { name: "Research notebook", exact: true })
    .click();
  await expect(source(page)).toHaveValue(ORIGINAL);
  await renamePage(page, "Project notebook");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("notebook.mdx");
  expect(await readFile((await download.path())!, "utf8")).toBe(ORIGINAL);
  await page.getByRole("link", { name: "Read", exact: true }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Project notebook", exact: true })
  ).toBeVisible();
  await expect(page.locator("[data-article]")).toContainText("Keep the original source intact.");
  await expect(page.getByRole("button", { name: "Toggle document navigation" })).toHaveAttribute(
    "aria-expanded",
    "false"
  );
  await page.getByRole("button", { name: "Toggle document navigation" }).click();
  const readerPages = localArticles(page);
  await expect(
    readerPages.getByRole("link", { name: "Reading questions", exact: true })
  ).toHaveAttribute("href", `/read/local?document=${childId}`);
  await readerPages.getByRole("button", { name: "Collapse Project notebook", exact: true }).click();
  await expect(
    readerPages.getByRole("link", { name: "Reading questions", exact: true })
  ).toHaveCount(0);
  await readerPages.getByRole("button", { name: "Expand Project notebook", exact: true }).click();
  await readerPages.getByRole("link", { name: "Reading questions", exact: true }).click();
  await expect(page).toHaveURL(`/read/local?document=${childId}`);
  await expect(page.getByRole("navigation", { name: "Page hierarchy" })).toContainText(
    "Project notebook"
  );
  await expect(page.getByRole("button", { name: "Toggle document navigation" })).toHaveAttribute(
    "aria-expanded",
    "true"
  );
  await expect(
    localArticles(page).getByRole("link", { name: "Reading questions", exact: true })
  ).toHaveAttribute("aria-current", "page");
  await expect(
    localArticles(page).getByRole("link", { name: "Project notebook", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Toggle document navigation" }).click();
  await page
    .getByRole("navigation", { name: "Page hierarchy" })
    .getByRole("link", { name: "Project notebook", exact: true })
    .click();
  await expect(page).toHaveURL(`/read/local?document=${parentId}`);
  await expect(page.getByRole("heading", { name: "Project notebook", exact: true })).toBeVisible();
  await expect(page.locator("[data-article]")).toContainText("Keep the original source intact.");
  await expect(page.getByRole("button", { name: "Toggle document navigation" })).toHaveAttribute(
    "aria-expanded",
    "false"
  );
  await expect(page.getByRole("complementary", { name: "Document navigation" })).toBeHidden();
});

test("excludes descendants from move targets, keeps children on move, and only removes a leaf page", async ({
  page,
}) => {
  const parentId = await createRoot(page);
  await page.getByRole("button", { name: "New subpage", exact: true }).click();
  await expect(source(page)).toHaveValue("# Untitled\n\n");
  const childId = new URL(page.url()).searchParams.get("document")!;
  await renamePage(page, "Child page");
  await page.getByRole("button", { name: "New subpage", exact: true }).click();
  await expect(page).not.toHaveURL(`/editor?document=${childId}`);
  await expect(source(page)).toHaveValue("# Untitled\n\n");
  await renamePage(page, "Grandchild page");
  const grandchildId = new URL(page.url()).searchParams.get("document")!;
  await page.goto(`/editor?document=${parentId}`);
  await expect(source(page)).toHaveValue(ORIGINAL);
  await page.getByRole("button", { name: "Page actions", exact: true }).click();
  await page.getByRole("button", { name: "Move page", exact: true }).click();
  const parents = page.getByRole("combobox", { name: "Parent page" });
  await expect(parents.getByRole("option")).toHaveText(["Top level"]);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Page actions", exact: true }).click();
  await page.getByRole("button", { name: "Remove page", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Move or remove its subpages first");
  await expect(page.getByRole("button", { name: "Remove page", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto(`/editor?document=${childId}`);
  await expect(source(page)).toHaveValue("# Untitled\n\n");
  await page.getByRole("button", { name: "Page actions", exact: true }).click();
  await page.getByRole("button", { name: "Move page", exact: true }).click();
  await page.getByRole("combobox", { name: "Parent page" }).selectOption("");
  await page.getByRole("button", { name: "Move page", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Page hierarchy" })).not.toContainText(
    "Research notebook"
  );
  await page.goto(`/editor?document=${grandchildId}`);
  await expect(page.getByRole("navigation", { name: "Page hierarchy" })).toContainText(
    "Child page"
  );
  await expect(page.getByRole("navigation", { name: "Page hierarchy" })).not.toContainText(
    "Research notebook"
  );
  await page.getByRole("button", { name: "Page actions", exact: true }).click();
  await page.getByRole("button", { name: "Remove page", exact: true }).click();
  await page.getByRole("button", { name: "Remove page", exact: true }).click();
  await expect(page).toHaveURL("/library?view=notes");
  await expect(
    page
      .getByRole("list", { name: "Saved pages" })
      .getByRole("link", { name: "Grandchild page", exact: true })
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("list", { name: "Saved pages" })
      .getByRole("link", { name: "Child page", exact: true })
  ).toBeVisible();
});

test("organizing controls wait for saved source and concurrent metadata conflicts retain the draft", async ({
  page,
  context,
}) => {
  const id = await createRoot(page);
  await source(page).fill(`${ORIGINAL}\nAn unsaved addition.\n`);
  await expect(page.getByRole("button", { name: "New subpage", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Page actions", exact: true })).toBeDisabled();
  await expect(saved(page)).toBeVisible();
  const other = await context.newPage();
  await other.goto(`/editor?document=${id}`);
  await expect(source(other)).toHaveValue(`${ORIGINAL}\nAn unsaved addition.\n`);
  await renamePage(other, "Renamed in another window");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("another window");
  await expect(source(page)).toHaveValue(`${ORIGINAL}\nAn unsaved addition.\n`);
  await expect(page.getByRole("button", { name: "Page actions", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Load saved version", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Page hierarchy" })).toContainText(
    "Renamed in another window"
  );
  await expect(page.getByRole("button", { name: "Page actions", exact: true })).toBeEnabled();
  await other.close();
});
