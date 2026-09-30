import { expect, test } from "playwright/test";

const mockAssistantEnabled = process.env.NEXT_PUBLIC_VERTO_ASSISTANT === "mock";

test("Reader Ask resumes saved document history and keeps the source after refresh", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route("**/agent-sources.json", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ sources: [], availableSourceCount: 0 }),
    })
  );
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("verto:e2e-document-thread-initialized")) return;
    window.sessionStorage.setItem("verto:e2e-document-thread-initialized", "true");
    window.localStorage.setItem(
      "verto:agent-threads",
      JSON.stringify({
        threads: [
          {
            id: "saved-document-thread",
            title: "Saved Reader question",
            scope: {
              kind: "document",
              href: "/read/demo",
              slug: ["demo"],
              title: "Verto Feature Demo",
            },
            messages: [
              { id: "user", role: "user", text: "Explain this document." },
              {
                id: "agent",
                role: "agent",
                text: "This document demonstrates Verto’s MDX blocks.",
              },
            ],
            createdAt: "2026-07-26T09:00:00.000Z",
            updatedAt: "2026-07-26T09:01:00.000Z",
          },
        ],
      })
    );
  });

  async function askFromReader() {
    await expect(page.locator("[data-article]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reading settings", exact: true })).toBeEnabled();
    await page.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("verto:ask-ai", { detail: { quote: "A passage from this document" } })
      );
    });
    await expect(page).toHaveURL(/\/agent\?/);
    await expect(page.getByRole("textbox", { name: "Message the agent" })).toHaveValue(
      /About this passage: "A passage from this document"/
    );
    await expect(page.getByText("Explain this document.", { exact: true })).toBeVisible();
    await expect(
      page.getByText("This document demonstrates Verto’s MDX blocks.", { exact: true })
    ).toBeVisible();
    await expect(page.locator("[data-agent-pane], .chat-col")).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("document")).toBe("/read/demo");
  }

  await page.goto("/read/demo");
  await askFromReader();
  const source = page.getByRole("link", { name: "Open Verto Feature Demo" });
  await expect(source).toHaveAttribute("href", "/read/demo");
  await source.click();
  await expect(page).toHaveURL(/\/read\/demo$/);
  await askFromReader();

  const documentThreads = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("verto:agent-threads") ?? "{}").threads.filter(
      (thread: { scope?: { href?: string } }) => thread.scope?.href === "/read/demo"
    )
  );
  expect(documentThreads).toHaveLength(1);
  expect(documentThreads[0].id).toBe("saved-document-thread");
  expect(documentThreads[0].messages).toHaveLength(2);

  await page.reload();
  await expect(page.getByText("Explain this document.", { exact: true })).toBeVisible();
  await expect(source).toHaveAttribute("href", "/read/demo");
  expect(new URL(page.url()).searchParams.get("document")).toBe("/read/demo");
  await page.getByRole("button", { name: "View Agent context", exact: true }).click();
  const context = page.locator("[data-agent-context]");
  await expect(context.getByRole("link", { name: /Verto Feature Demo/ })).toHaveAttribute(
    "href",
    "/read/demo"
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Conversation history", exact: true }).click();
  const conversation = page.getByRole("button", { name: "Saved Reader question", exact: true });
  await expect(conversation.locator("[data-agent-history-scope]")).toHaveText(
    "Page · Verto Feature Demo"
  );
});

test.describe("Reader conversations in standalone Agent", () => {
  test.skip(!mockAssistantEnabled, "Runs against the deterministic mock Agent provider.");
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto("/read/demo");
    await page.evaluate(() => window.localStorage.removeItem("verto:agent-threads"));
    await page.reload();
  });

  test("restores a document exchange after returning from Reader and deletes it durably", async ({
    page,
  }) => {
    const question = "What is this document about?";
    const quote = "A passage from this document";

    async function askFromReader() {
      await expect(page.locator("[data-article]")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Reading settings", exact: true })
      ).toBeEnabled();
      await page.evaluate((passage) => {
        window.dispatchEvent(new CustomEvent("verto:ask-ai", { detail: { quote: passage } }));
      }, quote);
      await expect(page).toHaveURL(/\/agent\?/);
      await expect(page.getByRole("textbox", { name: "Message the agent" })).toHaveValue(
        new RegExp(`About this passage: "${quote}"`)
      );
      expect(new URL(page.url()).searchParams.get("document")).toBe("/read/demo");
      await expect(page.getByRole("link", { name: "Open Verto Feature Demo" })).toHaveAttribute(
        "href",
        "/read/demo"
      );
      await expect(page.locator("[data-agent-pane], .chat-col")).toHaveCount(0);
    }

    await askFromReader();
    const composer = page.getByRole("textbox", { name: "Message the agent" });
    await expect(composer).toBeEnabled();
    await composer.fill(question);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("Verto is an MDX reader", { exact: false })).toBeVisible();

    const persisted = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("verto:agent-threads") ?? "{}")
    );
    const documentThreads = persisted.threads.filter(
      (thread: { scope?: { href?: string } }) => thread.scope?.href === "/read/demo"
    );
    expect(documentThreads).toHaveLength(1);
    expect(documentThreads[0]).toMatchObject({
      scope: {
        kind: "document",
        href: "/read/demo",
        slug: ["demo"],
        title: "Verto Feature Demo",
      },
    });
    expect(documentThreads[0].messages).toHaveLength(2);
    const threadId = documentThreads[0].id;

    await page.getByRole("link", { name: "Open Verto Feature Demo" }).click();
    await expect(page).toHaveURL(/\/read\/demo$/);
    await askFromReader();
    await expect(page.getByText(question, { exact: true })).toBeVisible();
    await expect(page.getByText("Verto is an MDX reader", { exact: false })).toBeVisible();
    const restored = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("verto:agent-threads") ?? "{}").threads.filter(
        (thread: { scope?: { href?: string } }) => thread.scope?.href === "/read/demo"
      )
    );
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(threadId);
    expect(restored[0].messages).toHaveLength(2);

    await page.reload();
    await expect(page.getByText(question, { exact: true })).toBeVisible();
    await expect(page.getByText("Verto is an MDX reader", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Verto Feature Demo" })).toHaveAttribute(
      "href",
      "/read/demo"
    );
    expect(new URL(page.url()).searchParams.get("document")).toBe("/read/demo");

    await page.getByRole("button", { name: "Conversation history", exact: true }).click();
    await page.getByRole("button", { name: `Delete ${question}`, exact: true }).click();
    await page.keyboard.press("Escape");
    await page.reload();
    await expect(page.getByRole("textbox", { name: "Message the agent" })).toBeEnabled();
    await expect(page.getByText(question, { exact: true })).toHaveCount(0);
    const remainingIds = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem("verto:agent-threads") ?? "{}").threads.map(
        (thread: { id: string }) => thread.id
      )
    );
    expect(remainingIds).not.toContain(threadId);
  });
});
