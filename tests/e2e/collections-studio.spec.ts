import { expect, test } from "playwright/test";

const summary = {
  href: "/read/demo",
  slug: ["demo"],
  title: "Verto Feature Demo",
  body: "## Main idea\n\nLocal files remain the source of truth.",
  model: "mock-grounded",
  contextNote: "Full document, 1,240 characters",
  createdAt: "2026-07-20T10:00:00.000Z",
};

const note = {
  id: "note-1",
  docSlug: "demo",
  quote: "The filesystem is the durable source of truth.",
  anchor: {
    quote: "The filesystem is the durable source of truth.",
    prefix: "",
    suffix: "",
    start: 0,
  },
  color: "yellow",
  turns: [
    {
      id: "turn-1",
      author: "human",
      body: "Use this as the storage principle.",
      createdAt: "2026-07-21T10:00:00.000Z",
    },
  ],
  createdAt: "2026-07-21T10:00:00.000Z",
  updatedAt: "2026-07-21T12:00:00.000Z",
};

test.describe("Collections workspace", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "verto:collections",
        JSON.stringify([
          {
            id: "research-queue",
            name: "Research queue",
            docHrefs: ["/read/demo"],
            docTitles: { "/read/demo": "Verto Feature Demo" },
            createdAt: "2026-07-01T00:00:00.000Z",
          },
          {
            id: "empty-project",
            name: "Empty project",
            docHrefs: [],
            createdAt: "2026-07-02T00:00:00.000Z",
          },
        ])
      );
    });
  });

  test("moves from the collection index into a source-linked detail", async ({ page }) => {
    await page.goto("/collections");

    await expect(page.getByRole("heading", { name: "Collections", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /Research queue.*1 item/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "By folder" })).toBeVisible();

    await page
      .getByRole("link", { name: /Research queue.*1 item/ })
      .first()
      .click();
    await expect(page).toHaveURL(/collection=research-queue/);
    await expect(page.getByRole("heading", { name: "Research queue", level: 2 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Verto Feature Demo" })).toHaveAttribute(
      "href",
      "/read/demo"
    );
    await expect(page.getByText("Library document", { exact: true })).toBeVisible();
  });

  test("creates a collection from a labelled keyboard-safe dialog", async ({ page }) => {
    await page.goto("/collections");

    await page.getByRole("button", { name: "New collection" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "New collection" })).toBeVisible();
    const input = dialog.getByRole("textbox", { name: "Collection name" });
    await expect(input).toBeFocused();
    await input.fill("Reading later");
    await dialog.getByRole("button", { name: "Create", exact: true }).click();

    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("link", { name: /Reading later.*0 items/ })).toBeVisible();
  });

  test("keeps the index and context inside a 390px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/collections");

    await expect(page.getByRole("heading", { name: "Collections", level: 1 })).toBeVisible();
    const bounds = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
  });
});

test.describe("Knowledge Studio evidence flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ savedSummary, savedNote }) => {
        window.localStorage.setItem(
          "verto:summaries",
          JSON.stringify({ summaries: [savedSummary] })
        );
        window.localStorage.setItem(
          "verto:annotations",
          JSON.stringify({ annotations: [savedNote] })
        );
      },
      { savedSummary: summary, savedNote: note }
    );
  });

  test("connects an insight to its exact passage and source document", async ({ page }) => {
    await page.goto("/studio?artifact=note%3Anote-1");

    await expect(page.getByRole("heading", { name: "Knowledge Studio", level: 1 })).toBeVisible();
    await expect(page.getByRole("tab", { name: /All insights.*2/ })).toHaveAttribute(
      "data-state",
      "active"
    );

    const evidence = page.getByRole("complementary", { name: "Source and citation" });
    await expect(evidence.getByRole("heading", { name: "Insight" })).toBeVisible();
    await expect(evidence.getByText("Use this as the storage principle.")).toBeVisible();
    await expect(evidence.getByRole("heading", { name: "Cited passage" })).toBeVisible();
    await expect(evidence.getByText(note.quote)).toBeVisible();
    await expect(evidence.getByRole("link", { name: "Open source" })).toHaveAttribute(
      "href",
      "/read/demo"
    );
  });

  test("distinguishes document-level summaries from exact passage notes", async ({ page }) => {
    await page.goto("/studio");

    await page
      .locator('button[data-kind="summary"]')
      .filter({ hasText: "Verto Feature Demo" })
      .click();
    const evidence = page.getByRole("complementary", { name: "Source and citation" });
    await expect(evidence.getByRole("heading", { name: "Source scope" })).toBeVisible();
    await expect(
      evidence.getByText("This summary is attached to the document as a whole.")
    ).toBeVisible();

    await page.getByRole("tab", { name: /Notes.*1/ }).click();
    await expect(page.locator('button[data-kind="note"]')).toHaveCount(1);
  });

  test("keeps insights and evidence inside a 390px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/studio?artifact=note%3Anote-1");

    await expect(page.getByRole("tab", { name: /All insights/ })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Source and citation" })).toBeVisible();
    const bounds = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
  });
});
