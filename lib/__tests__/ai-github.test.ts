import { describe, it, expect, vi } from "vitest";

import {
  createGitHubModelsProvider,
  DEFAULT_GITHUB_MODEL,
  GITHUB_MODELS_ENDPOINT,
} from "@/lib/ai/github-copilot";
import { getAssistantConfig, createAssistantProvider } from "@/lib/ai";
import { AssistantError } from "@/lib/ai/types";
import {
  buildSystemPrompt,
  buildMessages,
  truncate,
  readDocContextFromDom,
} from "@/lib/ai/context";
import { READING_COMPANION_PROMPTS } from "@/lib/ai/reading-companion";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function completion(content: string, model = DEFAULT_GITHUB_MODEL) {
  return { model, choices: [{ message: { role: "assistant", content } }] };
}

// ---------------------------------------------------------------------------
// getAssistantConfig
// ---------------------------------------------------------------------------

describe("getAssistantConfig", () => {
  it("disables the assistant by default", () => {
    const cfg = getAssistantConfig({ assistant: "" });
    expect(cfg.kind).toBe("none");
    expect(cfg.enabled).toBe(false);
    expect(cfg.model).toBe(DEFAULT_GITHUB_MODEL);
  });

  it("enables the github backend and accepts aliases", () => {
    for (const alias of ["github", "GitHub", "copilot", "github-models"]) {
      const cfg = getAssistantConfig({ assistant: alias });
      expect(cfg.kind).toBe("github");
      expect(cfg.enabled).toBe(true);
    }
  });

  it("honours a custom model override", () => {
    const cfg = getAssistantConfig({
      assistant: "github",
      model: "openai/gpt-4o",
    });
    expect(cfg.model).toBe("openai/gpt-4o");
  });
});

// ---------------------------------------------------------------------------
// createAssistantProvider
// ---------------------------------------------------------------------------

describe("createAssistantProvider", () => {
  it("builds a github provider", () => {
    const provider = createAssistantProvider({
      kind: "github",
      token: "tok",
      fetchImpl: vi.fn(),
    });
    expect(provider.id).toBe("github");
  });

  it("throws when the backend is disabled", () => {
    expect(() =>
      createAssistantProvider({
        kind: "none",
        token: "tok",
        fetchImpl: vi.fn(),
      })
    ).toThrow(AssistantError);
  });
});

// ---------------------------------------------------------------------------
// createGitHubModelsProvider — request construction
// ---------------------------------------------------------------------------

describe("createGitHubModelsProvider", () => {
  it("requires a token", () => {
    expect(() => createGitHubModelsProvider({ token: "", fetchImpl: vi.fn() })).toThrowError(
      /Missing GitHub token/
    );
  });

  it("posts an OpenAI-compatible request and parses the reply", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(completion("Hello!")));
    const provider = createGitHubModelsProvider({
      token: "secret-token",
      fetchImpl: fetchMock,
    });

    const result = await provider.chat([{ role: "user", content: "hi" }]);

    expect(result.content).toBe("Hello!");
    expect(result.model).toBe(DEFAULT_GITHUB_MODEL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GITHUB_MODELS_ENDPOINT);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer secret-token");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(DEFAULT_GITHUB_MODEL);
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(body.temperature).toBe(0.3);
  });

  it("uses a custom model and endpoint when provided", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(completion("ok", "openai/gpt-4o")));
    const provider = createGitHubModelsProvider({
      token: "t",
      model: "openai/gpt-4o",
      endpoint: "https://proxy.example/chat",
      fetchImpl: fetchMock,
    });

    await provider.chat([{ role: "user", content: "q" }]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://proxy.example/chat");
    expect(JSON.parse(init.body as string).model).toBe("openai/gpt-4o");
  });

  it("includes max_tokens only when set", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(completion("ok")));
    const provider = createGitHubModelsProvider({
      token: "t",
      fetchImpl: fetchMock,
    });

    await provider.chat([{ role: "user", content: "q" }], { maxTokens: 256 });
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string
    );
    expect(body.max_tokens).toBe(256);
  });

  it("maps 429 to a rate_limited AssistantError", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("slow down", {
          status: 429,
          headers: { "retry-after": "12" },
        })
    );
    const provider = createGitHubModelsProvider({
      token: "t",
      fetchImpl: fetchMock,
    });

    await expect(provider.chat([{ role: "user", content: "q" }])).rejects.toMatchObject({
      code: "rate_limited",
      status: 429,
    });
  });

  it("maps non-ok responses to http_error", async () => {
    const fetchMock = vi.fn(
      async () => new Response("nope", { status: 401, statusText: "Unauthorized" })
    );
    const provider = createGitHubModelsProvider({
      token: "t",
      fetchImpl: fetchMock,
    });

    await expect(provider.chat([{ role: "user", content: "q" }])).rejects.toMatchObject({
      code: "http_error",
      status: 401,
    });
  });

  it("throws on a malformed response body", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ choices: [] }));
    const provider = createGitHubModelsProvider({
      token: "t",
      fetchImpl: fetchMock,
    });

    await expect(provider.chat([{ role: "user", content: "q" }])).rejects.toMatchObject({
      code: "bad_response",
    });
  });

  it("surfaces an API error payload", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: { message: "model not found" } }));
    const provider = createGitHubModelsProvider({
      token: "t",
      fetchImpl: fetchMock,
    });

    await expect(provider.chat([{ role: "user", content: "q" }])).rejects.toThrowError(
      /model not found/
    );
  });

  it("wraps network failures", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("connection refused");
    });
    const provider = createGitHubModelsProvider({
      token: "t",
      fetchImpl: fetchMock,
    });

    await expect(provider.chat([{ role: "user", content: "q" }])).rejects.toMatchObject({
      code: "network",
    });
  });
});

// ---------------------------------------------------------------------------
// context helpers
// ---------------------------------------------------------------------------

describe("context helpers", () => {
  it("truncate collapses whitespace and clips with an ellipsis", () => {
    expect(truncate("  a   b\n\nc ", 100)).toBe("a b c");
    expect(truncate("abcdef", 3)).toBe("abc…");
  });

  it("buildSystemPrompt embeds the document when present", () => {
    const prompt = buildSystemPrompt({ title: "Intro", body: "Hello world" });
    expect(prompt).toContain("Title: Intro");
    expect(prompt).toContain("Hello world");
    expect(prompt).toContain("CURRENT DOCUMENT");
    expect(prompt).toContain("reading companion");
    expect(prompt).toContain("understand, annotate, extract, and connect");
    expect(prompt).toContain("Do not invent quotes, links, backlinks");
  });

  it("buildSystemPrompt omits the document block when empty", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).not.toContain("CURRENT DOCUMENT");
  });

  it("buildMessages assembles system + history + question", () => {
    const messages = buildMessages(
      { title: "Doc" },
      [{ role: "assistant", content: "prior" }],
      "new question"
    );
    expect(messages[0].role).toBe("system");
    expect(messages[1]).toEqual({ role: "assistant", content: "prior" });
    expect(messages[2]).toEqual({ role: "user", content: "new question" });
  });

  it("readDocContextFromDom returns empty context without a document", () => {
    expect(readDocContextFromDom(undefined)).toEqual({});
  });
});

describe("reading companion prompts", () => {
  it("covers understanding, explanation, extraction, and connection actions", () => {
    expect(READING_COMPANION_PROMPTS.map((prompt) => prompt.label)).toEqual([
      "Understand",
      "Explain",
      "Extract note",
      "Connect",
    ]);

    const combinedPrompts = READING_COMPANION_PROMPTS.map((prompt) => prompt.prompt).join("\n");
    expect(combinedPrompts).toContain("understand this document");
    expect(combinedPrompts).toContain("plain language");
    expect(combinedPrompts).toContain("MDX reading note");
    expect(combinedPrompts).toContain("follow-up reading");
  });

  it("keeps companion prompts grounded in the current document", () => {
    for (const prompt of READING_COMPANION_PROMPTS) {
      expect(prompt.prompt).toMatch(/document|provided context|Base it only/);
    }
  });

  it("does not claim access to the user's library or existing backlinks", () => {
    const prompts = READING_COMPANION_PROMPTS.map((prompt) => prompt.prompt).join("\n");
    expect(prompts).not.toMatch(/my library|existing notes|backlinks/i);
    expect(prompts).toContain("do not claim access to other notes");
  });
});
