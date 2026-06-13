// GitHub Copilot / GitHub Models assistant provider.
//
// GitHub Models exposes an OpenAI-compatible chat-completions endpoint that
// authenticates with a GitHub token — the same kind of token the desktop app
// already obtains through the OAuth device flow. That makes it the natural fit
// for "GitHub Copilot as an AI assistant" inside Verto: no extra account, no
// client secret, and it reuses the existing sign-in.
//
// The provider takes an injected `fetch` so it runs against the Tauri HTTP
// plugin in production (bypassing the webview's CORS restrictions) and a mock
// in tests.

import type { FetchLike } from "@/lib/tauri";
import {
  AssistantError,
  type AssistantProvider,
  type ChatMessage,
  type ChatOptions,
  type ChatResult,
} from "./types";

/**
 * Default GitHub Models inference endpoint (OpenAI-compatible). Overridable so
 * deployments can point at a compatible proxy without code changes.
 */
export const GITHUB_MODELS_ENDPOINT = "https://models.github.ai/inference/chat/completions";

/** A small, fast, widely-available default model. */
export const DEFAULT_GITHUB_MODEL = "openai/gpt-4o-mini";

export interface GitHubModelsOptions {
  /** GitHub access token (from the device flow or a PAT with Models access). */
  token: string;
  /** Model id, e.g. "openai/gpt-4o-mini". Falls back to the default. */
  model?: string;
  /** Injected fetch (Tauri HTTP in prod, mock in tests). */
  fetchImpl: FetchLike;
  /** Override the inference endpoint. */
  endpoint?: string;
}

/** Minimal OpenAI-compatible response shape we read from. */
interface RawChatCompletion {
  model?: string;
  choices?: Array<{
    message?: { role?: string; content?: string | null };
    finish_reason?: string;
  }>;
  error?: { message?: string; code?: string } | string;
}

function headers(token: string): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "verto-assistant",
    Authorization: "Bearer " + token,
  };
}

/**
 * Build a GitHub Models provider. Throws immediately when no token is supplied
 * so callers fail loudly instead of making an unauthenticated request.
 */
export function createGitHubModelsProvider(opts: GitHubModelsOptions): AssistantProvider {
  if (!opts.token) {
    throw new AssistantError(
      "Missing GitHub token. Sign in with GitHub (desktop) or set an API key.",
      "no_token"
    );
  }
  const model = (opts.model ?? "").trim() || DEFAULT_GITHUB_MODEL;
  const endpoint = opts.endpoint ?? GITHUB_MODELS_ENDPOINT;

  return {
    id: "github",
    model,
    async chat(messages: ChatMessage[], chatOpts?: ChatOptions): Promise<ChatResult> {
      const body: Record<string, unknown> = {
        model: chatOpts?.model ?? model,
        messages,
        temperature: chatOpts?.temperature ?? 0.3,
      };
      if (chatOpts?.maxTokens != null) {
        body.max_tokens = chatOpts.maxTokens;
      }

      let res: Response;
      try {
        res = await opts.fetchImpl(endpoint, {
          method: "POST",
          headers: headers(opts.token),
          body: JSON.stringify(body),
          signal: chatOpts?.signal,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new AssistantError(`Network error contacting GitHub Models: ${message}`, "network");
      }

      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        throw new AssistantError(
          retryAfter
            ? `Rate limited by GitHub Models. Retry after ${retryAfter}s.`
            : "Rate limited by GitHub Models. Please wait and try again.",
          "rate_limited",
          429
        );
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new AssistantError(
          `GitHub Models request failed: ${res.status} ${res.statusText}` +
            (text ? ` — ${text.slice(0, 200)}` : ""),
          "http_error",
          res.status
        );
      }

      const data = (await res.json()) as RawChatCompletion;
      if (data.error) {
        const message =
          typeof data.error === "string"
            ? data.error
            : (data.error.message ?? "Unknown assistant error.");
        throw new AssistantError(message, "api_error");
      }

      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new AssistantError(
          "GitHub Models returned an unexpected response shape.",
          "bad_response"
        );
      }

      return { content, model: data.model ?? model };
    },
  };
}
