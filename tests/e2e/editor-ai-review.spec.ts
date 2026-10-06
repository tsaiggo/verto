import { expect, test, type Locator, type Page } from "playwright/test";

// CI runs this alongside agent-enabled-provider.spec.ts against its separate
// GitHub-enabled production build. Every model request is fulfilled locally.
const MODELS_ENDPOINT = "https://models.github.ai/inference/chat/completions";
const MODEL = process.env.NEXT_PUBLIC_VERTO_ASSISTANT_MODEL ?? "";
const TOKEN = "playwright-editor-review-token";
const INITIAL_SOURCE = "# Draft\n\nA quiet opening.\n\nKeep this ending.\n";
const UPDATED_SOURCE = "# Draft\n\nStart with the core claim.\n\nKeep this ending.\n";
const INSTRUCTION = "Make the opening direct.";

interface ProviderRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
}

async function expectTouchable(page: Page, button: Locator) {
  await expect(button).toBeEnabled();
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeInViewport();
  const box = (await button.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

test.describe("Mobile Editor with an enabled provider", () => {
  test.skip(
    process.env.NEXT_PUBLIC_VERTO_ASSISTANT !== "github" || !MODEL,
    "Run against the GitHub-enabled build with NEXT_PUBLIC_VERTO_ASSISTANT_MODEL."
  );
  test.use({ viewport: { width: 320, height: 800 } });

  for (const theme of ["light", "dark"] as const) {
    test(`keeps generated review, approval, and undo reachable in ${theme} mode`, async ({
      page,
    }) => {
      const requests: Array<{ body: ProviderRequest; authorization: string | undefined }> = [];
      const unexpectedRequests: string[] = [];
      await page.addInitScript(
        ({ mode, token }) => {
          window.localStorage.setItem("theme", mode);
          window.localStorage.setItem("verto:assistant:token", token);
        },
        { mode: theme, token: TOKEN }
      );
      await page.route("https://models.github.ai/**", async (route) => {
        const request = route.request();
        const corsHeaders = {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "authorization, content-type",
        };
        if (request.url() !== MODELS_ENDPOINT || !["POST", "OPTIONS"].includes(request.method())) {
          unexpectedRequests.push(`${request.method()} ${request.url()}`);
          await route.abort("blockedbyclient");
          return;
        }
        if (request.method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: corsHeaders });
          return;
        }
        requests.push({
          body: request.postDataJSON() as ProviderRequest,
          authorization: request.headers().authorization,
        });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: corsHeaders,
          body: JSON.stringify({
            model: MODEL,
            choices: [
              {
                message: {
                  role: "assistant",
                  content: JSON.stringify({
                    summary: "Uses a direct opening",
                    oldText: "A quiet opening.",
                    newText: "Start with the core claim.",
                  }),
                },
                finish_reason: "stop",
              },
            ],
          }),
        });
      });

      await page.goto("/editor");
      expect(
        await page.locator("html").evaluate((element) => element.classList.contains("dark"))
      ).toBe(theme === "dark");
      const source = page.getByRole("combobox", { name: "MDX source", exact: true });
      await expect(source).toBeEditable();
      await page.getByRole("textbox", { name: "Filename" }).fill("ai-review.mdx");
      await source.fill(INITIAL_SOURCE);
      await expect(page).toHaveURL(/\/editor\?document=/);
      await expect(
        page.getByRole("status").filter({ hasText: "Saved in this browser" })
      ).toBeVisible();
      await page.getByRole("button", { name: "Edit with AI", exact: true }).click();
      const agent = page.getByRole("complementary", { name: "Edit with AI", exact: true });
      await agent.getByRole("textbox", { name: "What should change?" }).fill(INSTRUCTION);
      const request = agent.getByRole("button", { name: "Review suggestion", exact: true });
      await expectTouchable(page, request);
      await request.click();

      const review = agent.getByRole("region", { name: "Agent edit review", exact: true });
      await expect(review).toContainText("Uses a direct opening");
      await expect(source).toHaveValue(INITIAL_SOURCE);
      await expect.poll(() => requests.length).toBe(1);
      expect(unexpectedRequests).toEqual([]);
      expect(requests[0]!.authorization).toBe(`Bearer ${TOKEN}`);
      expect(requests[0]!.body.model).toBe(MODEL);
      expect(requests[0]!.body.messages).toHaveLength(2);
      expect(requests[0]!.body.messages[0]!.role).toBe("system");
      expect(requests[0]!.body.messages[1]!.role).toBe("user");
      expect(JSON.parse(requests[0]!.body.messages[1]!.content)).toEqual({
        request: INSTRUCTION,
        filename: "ai-review.mdx",
        format: "mdx",
        source: INITIAL_SOURCE,
      });

      const approve = review.getByRole("button", { name: "Approve and apply", exact: true });
      await expectTouchable(page, approve);
      await approve.click();
      await expect(source).toHaveValue(UPDATED_SOURCE);
      const receipt = agent.getByRole("region", { name: "Applied agent edit", exact: true });
      const undo = receipt.getByRole("button", { name: "Undo agent edit", exact: true });
      await expectTouchable(page, undo);
      await undo.click();
      await expect(source).toHaveValue(INITIAL_SOURCE);
      await expect(agent.getByRole("status")).toContainText(
        "Agent edit undone in the current draft"
      );
      expect(requests).toHaveLength(1);
      expect(unexpectedRequests).toEqual([]);
    });
  }
});
