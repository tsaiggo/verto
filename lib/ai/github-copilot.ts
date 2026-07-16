// GitHub Models assistant provider.
//
// The model endpoint uses a manually supplied GitHub Models token. Verto does
// not create, store, or reuse a GitHub login session.
import type { FetchLike } from "@/lib/tauri";
import {
  AssistantError,
  type AssistantProvider,
  type ChatMessage,
  type ChatOptions,
  type ChatResult,
  type ToolCall,
  type ToolSpec,
} from "./types";

/**
 * Default GitHub Models inference endpoint (OpenAI-compatible). Overridable so
 * deployments can point at a compatible proxy without code changes.
 */
export const GITHUB_MODELS_ENDPOINT = "https://models.github.ai/inference/chat/completions";

/** A small, fast, widely-available default model. */
export const DEFAULT_GITHUB_MODEL = "openai/gpt-4o-mini";

export interface GitHubModelsOptions {
  /** GitHub Models token supplied by the user. */
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
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
    };
    finish_reason?: string;
  }>;
  error?: { message?: string; code?: string } | string;
}

function serializeMessages(messages: ChatMessage[]): unknown[] {
  return messages.map((m) => {
    if (m.role === "assistant" && m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content,
        tool_calls: m.toolCalls.map((c) => ({
          id: c.id,
          type: "function",
          function: { name: c.name, arguments: c.args },
        })),
      };
    }
    if (m.role === "tool") return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
    return { role: m.role, content: m.content };
  });
}

function serializeTools(tools: ToolSpec[]): unknown[] {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

function readToolCalls(
  message:
    | { tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> }
    | undefined
): ToolCall[] {
  const raw = message?.tool_calls;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c.id && c.function?.name)
    .map((c) => ({
      id: c.id as string,
      name: c.function!.name as string,
      args: c.function?.arguments ?? "{}",
    }));
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
      "Missing GitHub Models token. Add an assistant access key in Settings.",
      "no_token"
    );
  }
  const model = (opts.model ?? "").trim() || DEFAULT_GITHUB_MODEL;
  const endpoint = opts.endpoint ?? GITHUB_MODELS_ENDPOINT;

  async function post(
    body: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<RawChatCompletion> {
    let res: Response;
    try {
      res = await opts.fetchImpl(endpoint, {
        method: "POST",
        headers: headers(opts.token),
        body: JSON.stringify(body),
        signal,
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
          (text ? `. ${text.slice(0, 200)}` : ""),
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
    return data;
  }

  return {
    id: "github",
    model,
    async chat(messages: ChatMessage[], chatOpts?: ChatOptions): Promise<ChatResult> {
      const body: Record<string, unknown> = {
        model: chatOpts?.model ?? model,
        messages: serializeMessages(messages),
        temperature: chatOpts?.temperature ?? 0.3,
      };
      if (chatOpts?.maxTokens != null) body.max_tokens = chatOpts.maxTokens;

      const data = await post(body, chatOpts?.signal);
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new AssistantError(
          "GitHub Models returned an unexpected response shape.",
          "bad_response"
        );
      }
      return { content, model: data.model ?? model };
    },
    async agentChat(messages, tools, chatOpts): Promise<ChatResult> {
      const body: Record<string, unknown> = {
        model: chatOpts?.model ?? model,
        messages: serializeMessages(messages),
        temperature: chatOpts?.temperature ?? 0.3,
        tools: serializeTools(tools),
        tool_choice: "auto",
      };
      if (chatOpts?.maxTokens != null) body.max_tokens = chatOpts.maxTokens;

      const data = await post(body, chatOpts?.signal);
      const message = data.choices?.[0]?.message;
      const toolCalls = readToolCalls(message);
      return { content: message?.content ?? "", model: data.model ?? model, toolCalls };
    },
  };
}
