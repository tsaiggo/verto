import { expect, test, type Page } from "playwright/test";

// Use an explicit port so Playwright starts a fresh Next process with these
// build-time variables instead of reusing a disabled-provider dev server:
// NEXT_PUBLIC_VERTO_ASSISTANT=github \
// NEXT_PUBLIC_VERTO_ASSISTANT_MODEL=openai/playwright-agent-model \
// PLAYWRIGHT_PORT=3117 npx playwright test tests/e2e/agent-enabled-provider.spec.ts --workers=1
const MODELS_ENDPOINT = "https://models.github.ai/inference/chat/completions";
const MODEL = process.env.NEXT_PUBLIC_VERTO_ASSISTANT_MODEL ?? "";
const FIRST_PROMPT = "What is the central idea in my workspace?";
const SECOND_PROMPT = "How does that connect to the demo document?";
const FIRST_REPLY = "The workspace centers on a focused local reading flow.";
const SECOND_REPLY = "The demo document shows that flow in practice.";

interface ProviderMessage {
  role: string;
  content: string;
  tool_call_id?: string;
}

interface ProviderRequest {
  model?: string;
  messages?: ProviderMessage[];
  tools?: Array<{ function: { name: string } }>;
}

interface PersistedThreadStore {
  threads: Array<{
    title: string;
    messages: Array<{ role: string; text: string }>;
  }>;
}

test.describe("Agent workspace with an enabled provider", () => {
  test.skip(
    process.env.NEXT_PUBLIC_VERTO_ASSISTANT !== "github" || !MODEL,
    "Run with NEXT_PUBLIC_VERTO_ASSISTANT=github and a custom NEXT_PUBLIC_VERTO_ASSISTANT_MODEL."
  );

  test.use({ viewport: { width: 1280, height: 800 } });

  test("keeps two-turn history, title, persistence, and model configuration in sync", async ({
    page,
  }) => {
    const requests: ProviderRequest[] = [];

    await page.addInitScript(() => {
      window.localStorage.setItem("verto:assistant:token", "playwright-test-token");
      if (!window.sessionStorage.getItem("verto:e2e-agent-initialized")) {
        window.localStorage.removeItem("verto:agent-threads");
        window.sessionStorage.setItem("verto:e2e-agent-initialized", "true");
      }
    });

    await page.route(MODELS_ENDPOINT, async (route) => {
      const request = route.request();
      const corsHeaders = {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "authorization, content-type",
      };

      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      requests.push(request.postDataJSON() as ProviderRequest);
      const content = requests.length === 1 ? FIRST_REPLY : SECOND_REPLY;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: corsHeaders,
        body: JSON.stringify({
          model: MODEL,
          choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
        }),
      });
    });

    await page.goto("/agent");

    const composer = page.getByRole("textbox", { name: "Message the agent" });
    await expect(composer).toBeEnabled();

    await composer.fill(FIRST_PROMPT);
    await composer.press("Enter");
    await expect(
      page.locator('[data-agent-message][data-role="assistant"]').filter({ hasText: FIRST_REPLY })
    ).toBeVisible();
    await expect(page.locator("[data-agent-conversation-title]")).toHaveText(FIRST_PROMPT);
    await page.getByRole("button", { name: "Conversation history", exact: true }).click();
    await expect(
      page.locator("[data-agent-history]").getByRole("button", { name: FIRST_PROMPT, exact: true })
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await composer.fill(SECOND_PROMPT);
    await composer.press("Enter");
    await expect(
      page.locator('[data-agent-message][data-role="assistant"]').filter({ hasText: SECOND_REPLY })
    ).toBeVisible();
    await expect.poll(() => requests.length).toBe(2);

    const firstRequest = requests[0]!;
    const secondRequest = requests[1]!;
    expect(firstRequest.model).toBe(MODEL);
    expect(firstRequest.messages).toBeDefined();
    expect(firstRequest.messages![0]).toMatchObject({ role: "system" });
    expect(firstRequest.messages!.slice(1)).toEqual([{ role: "user", content: FIRST_PROMPT }]);
    expect(secondRequest.model).toBe(MODEL);
    expect(secondRequest.messages).toBeDefined();
    expect(secondRequest.messages![0]).toMatchObject({ role: "system" });
    expect(secondRequest.messages!.slice(1)).toEqual([
      { role: "user", content: FIRST_PROMPT },
      { role: "assistant", content: FIRST_REPLY },
      { role: "user", content: SECOND_PROMPT },
    ]);

    const persisted = (await page.evaluate(() => {
      const raw = window.localStorage.getItem("verto:agent-threads");
      return raw ? JSON.parse(raw) : null;
    })) as PersistedThreadStore | null;
    expect(persisted).not.toBeNull();
    expect(persisted!.threads[0]!.title).toBe(FIRST_PROMPT);
    expect(persisted!.threads[0]!.messages).toMatchObject([
      { role: "user", text: FIRST_PROMPT },
      { role: "agent", text: FIRST_REPLY },
      { role: "user", text: SECOND_PROMPT },
      { role: "agent", text: SECOND_REPLY },
    ]);

    await page.reload();

    await expect(page.locator("[data-agent-conversation-title]")).toHaveText(FIRST_PROMPT);
    await expect(page.locator("[data-agent-stream] [data-agent-message]")).toHaveCount(4);
    await expect(
      page.locator('[data-agent-message][data-role="assistant"]').filter({ hasText: FIRST_REPLY })
    ).toBeVisible();
    await expect(
      page.locator('[data-agent-message][data-role="assistant"]').filter({ hasText: SECOND_REPLY })
    ).toBeVisible();
  });
});

async function seedScopedArticles(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("verto.articles", 3);
      request.onupgradeneeded = () => {
        for (const name of ["articles", "documents", "mdx-books"]) {
          if (!request.result.objectStoreNames.contains(name))
            request.result.createObjectStore(name, { keyPath: "id" });
        }
        for (const name of ["document-bytes", "book-assets"]) {
          if (!request.result.objectStoreNames.contains(name))
            request.result.createObjectStore(name);
        }
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("articles", "readwrite");
        const now = "2026-10-06T00:00:00Z";
        for (const article of [
          {
            id: "scope-a",
            title: "Scoped evidence",
            filename: "scope.md",
            source: "# Scoped evidence\n\nScope evidence: Agents only read the selected document.",
          },
          {
            id: "scope-b",
            title: "Other document",
            filename: "other.md",
            source:
              "# Other document\n\nUNAUTHORIZED_SOURCE_BODY_8F4D must stay outside this conversation.",
          },
        ])
          transaction
            .objectStore("articles")
            .put({ ...article, status: "saved", revision: 1, createdAt: now, updatedAt: now });
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });
}

test("retrieves saved passages, rejects another document in a scoped conversation, and opens verified citations", async ({
  page,
}) => {
  test.skip(
    process.env.NEXT_PUBLIC_VERTO_ASSISTANT !== "github" || !MODEL,
    "Requires the enabled-provider build."
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  const requests: ProviderRequest[] = [];
  const href = "/read/local?document=scope-a";
  await page.addInitScript(() => {
    localStorage.setItem("verto:assistant:token", "playwright-test-token");
  });
  await page.goto("/");
  await seedScopedArticles(page);

  await page.route(MODELS_ENDPOINT, async (route) => {
    const corsHeaders = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization, content-type",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const request = route.request().postDataJSON() as ProviderRequest;
    requests.push(request);
    let message: {
      role: string;
      content: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    };
    const call = (id: string, name: string, args: Record<string, unknown>) => ({
      id,
      type: "function",
      function: { name, arguments: JSON.stringify(args) },
    });
    if (requests.length === 1) {
      expect(request.tools?.map((tool) => tool.function.name)).toEqual([
        "list_documents",
        "search_documents",
        "read_document",
        "list_annotations",
        "resolve_citation",
      ]);
      expect(request.messages?.[0]?.content).toContain(
        "Other documents are outside this conversation's scope"
      );
      message = {
        role: "assistant",
        content: "",
        tool_calls: [
          call("search", "search_documents", { query: "selected document" }),
          call("denied", "read_document", { docId: "managed:scope-b" }),
        ],
      };
    } else if (requests.length === 2) {
      const search = JSON.parse(
        request.messages!.find((item) => item.tool_call_id === "search")!.content
      );
      expect(search.matches).toHaveLength(1);
      expect(search.matches[0].document.id).toBe("managed:scope-a");
      expect(request.messages!.find((item) => item.tool_call_id === "denied")!.content).toBe(
        "Document is unavailable."
      );
      message = {
        role: "assistant",
        content: "",
        tool_calls: [
          call("read", "read_document", {
            docId: search.matches[0].document.id,
            version: search.matches[0].document.version,
            offset: search.matches[0].blockIndex,
            limit: 1,
          }),
        ],
      };
    } else {
      expect(requests.length).toBe(3);
      const read = JSON.parse(
        request.messages!.find((item) => item.tool_call_id === "read")!.content
      );
      expect(read.document.id).toBe("managed:scope-a");
      expect(read.blocks).toHaveLength(1);
      expect(read.blocks[0].text).toContain("Agents only read the selected document");
      expect(read.blocks[0].evidenceToken).toBe("e1");
      expect(read.coverage.textOnly).toBe(true);
      message = {
        role: "assistant",
        content: `Agents only read the selected document. [[evidence:${read.blocks[0].evidenceToken}]] [[evidence:forged]]`,
      };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify({
        model: MODEL,
        choices: [{ message, finish_reason: message.tool_calls ? "tool_calls" : "stop" }],
      }),
    });
  });
  await page.goto(`/agent?${new URLSearchParams({ document: href })}`);
  const composer = page.getByRole("textbox", { name: "Message the agent" });
  await expect(composer).toBeEnabled();
  await composer.fill("Explain the saved scope evidence");
  await composer.press("Enter");
  const response = page.locator('[data-agent-message][data-role="assistant"]');
  await expect(response).toContainText("Agents only read the selected document");
  await expect(response).not.toContainText("forged");
  await expect.poll(() => requests.length).toBe(3);
  expect(JSON.stringify(requests)).not.toContain("UNAUTHORIZED_SOURCE_BODY_8F4D");
  const citation = response.getByRole("group", { name: "Sources cited" }).getByRole("link");
  await expect(citation).toHaveCount(1);
  const citationHref = await citation.getAttribute("href");
  expect(citationHref).toContain(`${href}#verto-citation=`);
  await page.reload();
  await expect(
    response.getByRole("group", { name: "Sources cited" }).getByRole("link")
  ).toHaveAttribute("href", citationHref!);
  await response.getByRole("group", { name: "Sources cited" }).getByRole("link").click();
  await expect(page).toHaveURL(/\/read\/local\?document=scope-a#verto-citation=/);
  await expect(
    page.locator('article[data-article] [data-agent-source-active="true"]')
  ).toContainText("Scope evidence: Agents only read the selected document.");
});
