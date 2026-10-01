import { readFile } from "node:fs/promises";
import axe from "axe-core";
import { expect, test, type Page } from "playwright/test";

const DEMO_SUBJECT = "Design review notes and next steps";
const DRAFT_SUBJECT = "A draft to finish tomorrow";

async function openDemo(page: Page) {
  await page.goto("/mail?demo=1");
  await expect(page.getByRole("heading", { name: "Mail", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Compose", exact: true })).toBeEnabled();
}

async function discardDraft(page: Page) {
  const composer = page.getByRole("form", { name: "Message draft" });
  await composer.getByRole("button", { name: "Discard draft", exact: true }).click();
  await composer.getByRole("button", { name: /Confirm discard|Discard draft/i }).click();
  await expect(composer).toHaveCount(0);
}

async function expectAccessibleMail(page: Page, state: string) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    });
    return result.violations
      .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        targets: violation.nodes.slice(0, 4).map((node) => node.target.join(" ")),
      }));
  });
  expect(violations, `${state} should have no serious automated WCAG violations`).toEqual([]);
}

test.describe("Mail workbench preview", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("keeps a local draft after closing, reopening, and reloading", async ({ page }) => {
    await openDemo(page);
    await page.getByRole("button", { name: "Compose", exact: true }).click();
    let composer = page.getByRole("form", { name: "Message draft" });
    await composer.getByLabel("To", { exact: true }).fill("reader@example.com");
    await composer.getByRole("button", { name: "Cc", exact: true }).click();
    await composer.getByRole("button", { name: "Bcc", exact: true }).click();
    await composer.getByLabel("Cc", { exact: true }).fill("reviewer@example.com");
    await composer.getByLabel("Bcc", { exact: true }).fill("archive@example.com");
    await composer.getByLabel("Subject", { exact: true }).fill(DRAFT_SUBJECT);
    await composer.getByLabel("Message body", { exact: true }).fill("Saved locally for tomorrow.");
    await composer.getByRole("button", { name: "Save & close", exact: true }).click();
    await expect(composer).toHaveCount(0);

    await page.getByRole("button", { name: /Local drafts/ }).click();
    await page.getByRole("button", { name: new RegExp(DRAFT_SUBJECT) }).click();
    composer = page.getByRole("form", { name: "Message draft" });
    await expect(composer.getByLabel("To", { exact: true })).toHaveValue("reader@example.com");
    await expect(composer.getByLabel("Cc", { exact: true })).toHaveValue("reviewer@example.com");
    await expect(composer.getByLabel("Bcc", { exact: true })).toHaveValue("archive@example.com");
    await expect(composer.getByLabel("Message body", { exact: true })).toHaveValue(
      "Saved locally for tomorrow."
    );
    await composer.getByLabel("Message body", { exact: true }).fill("Autosaved before reloading.");
    await page.reload();
    await page.getByRole("button", { name: /Local drafts/ }).click();
    await page.getByRole("button", { name: new RegExp(DRAFT_SUBJECT) }).click();
    composer = page.getByRole("form", { name: "Message draft" });
    await expect(composer.getByLabel("Subject", { exact: true })).toHaveValue(DRAFT_SUBJECT);
    await expect(composer.getByLabel("Message body", { exact: true })).toHaveValue(
      "Autosaved before reloading."
    );
    await discardDraft(page);
    await expect(page.getByRole("button", { name: new RegExp(DRAFT_SUBJECT) })).toHaveCount(0);
  });

  test("addresses replies, quotes forwards, and downloads the preview attachment", async ({
    page,
  }) => {
    await openDemo(page);
    const detail = page.getByRole("region", { name: "Message preview" });
    await expect(detail.getByRole("heading", { name: DEMO_SUBJECT, exact: true })).toBeVisible();
    await detail.getByRole("button", { name: "Reply", exact: true }).click();
    let composer = page.getByRole("form", { name: "Message draft" });
    await expect(composer.getByLabel("To", { exact: true })).toHaveValue("design-team@example.com");
    await expect(composer.getByLabel("Subject", { exact: true })).toHaveValue(
      `Re: ${DEMO_SUBJECT}`
    );
    await discardDraft(page);

    await detail.getByRole("button", { name: "Reply all", exact: true }).click();
    composer = page.getByRole("form", { name: "Message draft" });
    const recipients = `${await composer.getByLabel("To", { exact: true }).inputValue()} ${await composer
      .getByLabel("Cc", { exact: true })
      .inputValue()}`;
    expect(recipients).toContain("design-team@example.com");
    expect(recipients).not.toContain("alex.morgan@example.com");
    await discardDraft(page);

    await detail.getByRole("button", { name: "Forward", exact: true }).click();
    composer = page.getByRole("form", { name: "Message draft" });
    await expect(composer.getByLabel("To", { exact: true })).toHaveValue("");
    await expect(composer.getByLabel("Subject", { exact: true })).toHaveValue(
      `Fwd: ${DEMO_SUBJECT}`
    );
    await expect(composer.getByLabel("Message body", { exact: true })).toHaveValue(
      /Maya Chen[\s\S]*Design review notes and next steps/
    );
    await discardDraft(page);

    const download = page.waitForEvent("download");
    await detail.getByRole("button", { name: /design-review-notes\.txt/ }).click();
    const downloaded = await download;
    expect(downloaded.suggestedFilename()).toBe("design-review-notes.txt");
    const attachmentPath = await downloaded.path();
    expect(attachmentPath).not.toBeNull();
    expect(await readFile(attachmentPath!, "utf8")).toContain(
      "Example attachment — Design review notes"
    );
  });

  test("keeps sample folder and message selection in the URL and clears empty folders", async ({
    page,
  }) => {
    await openDemo(page);
    const list = page.getByTestId("mail-message-list");
    await page.getByLabel("Search loaded messages", { exact: true }).fill("no-such-message");
    await expect(list.getByRole("heading", { name: "No matching messages" })).toBeVisible();
    await list.getByRole("button", { name: "Clear filters", exact: true }).click();
    await list.getByRole("link", { name: /Three essays for the weekend reading list/ }).click();
    await expect(page).toHaveURL(/demo=1&folder=INBOX&message=demo-reading-list$/);
    const detail = page.getByRole("region", { name: "Message preview" });
    await expect(
      detail.getByRole("heading", {
        name: "Three essays for the weekend reading list",
        exact: true,
      })
    ).toBeVisible();
    await page.reload();
    await expect(
      detail.getByRole("heading", {
        name: "Three essays for the weekend reading list",
        exact: true,
      })
    ).toBeVisible();
    const folders = page.locator("#main-content").getByRole("navigation", { name: "Mail folders" });
    await folders.getByRole("link", { name: "Archive", exact: true }).click();
    await expect(page).toHaveURL(/demo=1&folder=ARCHIVE$/);
    await expect(folders.getByRole("link", { name: "Archive", exact: true })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(list.getByRole("heading", { name: "No messages in this folder." })).toBeVisible();
    await expect(detail).toContainText("Select a message to read it.");
    await expect(detail.getByRole("heading", { name: DEMO_SUBJECT, exact: true })).toHaveCount(0);
  });

  test("validates a preview send and never reaches a mail provider", async ({ page }) => {
    const providerRequests: string[] = [];
    await page.route(
      /^https:\/\/(?:accounts\.google\.com|[^/]*googleapis\.com|login\.microsoftonline\.com|graph\.microsoft\.com)\//,
      async (route) => {
        providerRequests.push(route.request().url());
        await route.fulfill({ status: 503, body: "Provider access is unavailable in preview." });
      }
    );
    await openDemo(page);
    await page.getByRole("button", { name: "Compose", exact: true }).click();
    const composer = page.getByRole("form", { name: "Message draft" });
    await composer.getByRole("button", { name: "Send preview", exact: true }).click();
    await expect(composer).toBeVisible();
    await expect(composer.getByRole("alert")).toContainText(/recipient|email|address/i);
    await composer.getByLabel("To", { exact: true }).fill("not-an-email");
    await composer.getByLabel("Subject", { exact: true }).fill("A simulated message");
    await composer
      .getByLabel("Message body", { exact: true })
      .fill("This only exercises the preview.");
    await composer.getByRole("button", { name: "Send preview", exact: true }).click();
    await expect(composer.getByRole("alert")).toContainText(/recipient|email|address/i);
    await composer.getByLabel("To", { exact: true }).fill("reader@example.com");
    await composer.getByRole("button", { name: "Send preview", exact: true }).click();
    await expect(composer).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText(/preview|simulat/i);
    expect(providerRequests).toEqual([]);
  });
});

for (const theme of ["light", "dark"] as const) {
  test(`Mail ${theme} theme has no serious automated WCAG violations in reading and composing`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript((mode) => window.localStorage.setItem("theme", mode), theme);
    await openDemo(page);
    await expect(
      page
        .getByRole("region", { name: "Message preview" })
        .getByRole("heading", { name: DEMO_SUBJECT, exact: true })
    ).toBeVisible();
    await expectAccessibleMail(page, `Mail ${theme} reading view`);
    await page.getByRole("button", { name: "Compose", exact: true }).click();
    const composer = page.getByRole("form", { name: "Message draft" });
    await composer.getByRole("button", { name: "Cc", exact: true }).click();
    await composer.getByRole("button", { name: "Bcc", exact: true }).click();
    await composer.getByLabel("To", { exact: true }).fill("reader@example.com");
    await composer.getByLabel("Subject", { exact: true }).fill("An accessible local draft");
    await composer
      .getByLabel("Message body", { exact: true })
      .fill("Recipient fields and message text are ready to read.");
    await expectAccessibleMail(page, `Mail ${theme} composer`);
  });

  test(`Mail ${theme} theme keeps list and detail scrolls within a short desktop viewport`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.addInitScript((mode) => window.localStorage.setItem("theme", mode), theme);
    await openDemo(page);
    const list = page.getByTestId("mail-message-list");
    const detail = page.getByTestId("mail-message-detail");
    await expect(list).toBeVisible();
    await expect(detail).toBeVisible();
    if (theme === "dark") await expect(page.locator("html")).toHaveClass(/dark/);
    else await expect(page.locator("html")).not.toHaveClass(/dark/);

    const geometry = await page.evaluate(() => {
      const listPane = document.querySelector<HTMLElement>('[data-testid="mail-message-list"]')!;
      const detailPane = document.querySelector<HTMLElement>(
        '[data-testid="mail-message-detail"]'
      )!;
      return {
        listBottom: listPane.getBoundingClientRect().bottom,
        detailBottom: detailPane.getBoundingClientRect().bottom,
        listClientHeight: listPane.clientHeight,
        listScrollHeight: listPane.scrollHeight,
        detailClientHeight: detailPane.clientHeight,
        detailScrollHeight: detailPane.scrollHeight,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    expect(geometry.listBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    expect(geometry.detailBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.listScrollHeight).toBeGreaterThan(geometry.listClientHeight);
    expect(geometry.detailScrollHeight).toBeGreaterThan(geometry.detailClientHeight);

    const detailTop = await detail.evaluate((element) => element.scrollTop);
    await list.evaluate((element) => (element.scrollTop = element.scrollHeight));
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await detail.evaluate((element) => element.scrollTop)).toBe(detailTop);
    const listTop = await list.evaluate((element) => element.scrollTop);
    await detail.evaluate((element) => (element.scrollTop = element.scrollHeight));
    await expect.poll(() => detail.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await list.evaluate((element) => element.scrollTop)).toBe(listTop);
    const lastParagraph = await detail.evaluate((element) => {
      const text =
        "Before we close the review, please confirm the keyboard paths and empty states are covered in the final checklist.";
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const index = node.textContent?.indexOf(text) ?? -1;
        if (index < 0) continue;
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + text.length);
        const rect = range.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom };
      }
      throw new Error("The closing review checklist paragraph is missing.");
    });
    expect(lastParagraph.top).toBeGreaterThanOrEqual(0);
    expect(lastParagraph.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
  });
}

test("Mail preview composer remains usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDemo(page);
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  const composer = page.getByRole("form", { name: "Message draft" });
  await composer.getByLabel("To", { exact: true }).fill("reader@example.com");
  await composer.getByLabel("Subject", { exact: true }).fill("Narrow viewport draft");
  await composer.getByLabel("Message body", { exact: true }).fill("All fields remain reachable.");
  await composer.getByRole("button", { name: "Save & close", exact: true }).click();
  await expect(composer).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  ).toBe(true);
});
