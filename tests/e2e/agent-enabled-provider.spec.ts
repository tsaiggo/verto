import { expect, test } from "playwright/test";

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
}

interface ProviderRequest {
  model?: string;
  messages?: ProviderMessage[];
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
    await expect(page.locator(".ag-bubble--agent").filter({ hasText: FIRST_REPLY })).toBeVisible();
    await expect(page.locator(".ag-session-title strong")).toHaveText(FIRST_PROMPT);
    await expect(
      page.locator(".ag-history").getByRole("button", { name: FIRST_PROMPT, exact: true })
    ).toBeVisible();

    await composer.fill(SECOND_PROMPT);
    await composer.press("Enter");
    await expect(page.locator(".ag-bubble--agent").filter({ hasText: SECOND_REPLY })).toBeVisible();
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

    await expect(page.locator(".ag-session-title strong")).toHaveText(FIRST_PROMPT);
    await expect(page.locator(".ag-stream .ag-msg")).toHaveCount(4);
    await expect(page.locator(".ag-bubble--agent").filter({ hasText: FIRST_REPLY })).toBeVisible();
    await expect(page.locator(".ag-bubble--agent").filter({ hasText: SECOND_REPLY })).toBeVisible();
  });
});
