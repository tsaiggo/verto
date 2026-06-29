// Shared types for the AI assistant layer.
//
// Verto's assistant is built around a small, pluggable `AssistantProvider`
// interface — mirroring the `ContentSource` abstraction used for content. A
// provider takes a list of chat messages and returns the model's reply. The
// concrete GitHub Models / Copilot implementation lives in `github-copilot.ts`;
// new backends can be added without touching the UI.

/** Who authored a chat message. "tool" carries a tool's result back to the model. */
export type ChatRole = "system" | "user" | "assistant" | "tool";

/** A request from the model to invoke a named tool with JSON arguments. */
export interface ToolCall {
  /** Provider-issued id; must be echoed on the matching tool result. */
  id: string;
  /** The tool name to dispatch. */
  name: string;
  /** Raw JSON argument string exactly as the model produced it. */
  args: string;
}

/** A single message in a chat conversation (OpenAI-compatible shape). */
export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Present on assistant turns that request tools. */
  toolCalls?: ToolCall[];
  /** Present on `tool` turns: the call this message answers. */
  toolCallId?: string;
}

/** An OpenAI-style function tool definition the provider advertises to the model. */
export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the function arguments. */
  parameters: Record<string, unknown>;
}

/** Per-request options. All optional; providers fall back to sane defaults. */
export interface ChatOptions {
  /** Override the provider's default model for this call. */
  model?: string;
  /** Sampling temperature (0–2). Lower is more deterministic. */
  temperature?: number;
  /** Cap on the number of tokens in the completion. */
  maxTokens?: number;
  /** Lets the caller abort an in-flight request. */
  signal?: AbortSignal;
}

/** The result of a successful chat completion. */
export interface ChatResult {
  /** The assistant's reply text. */
  content: string;
  /** The model that actually produced the reply (may differ from requested). */
  model: string;
  /** Tool calls the model requested, when run via `agentChat`. */
  toolCalls?: ToolCall[];
}

/**
 * A chat backend. Implementations are constructed with their own credentials
 * and an injected `fetch`, so they can run against the Tauri HTTP plugin in
 * production (bypassing CORS) and a mock in tests.
 */
export interface AssistantProvider {
  /** Stable identifier, e.g. "github". */
  readonly id: string;
  /** The default model this provider sends requests to. */
  readonly model: string;
  /** Send a conversation and resolve with the assistant's reply. */
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
  /** Send a conversation plus tool specs; reply may request tool calls. */
  agentChat?(messages: ChatMessage[], tools: ToolSpec[], opts?: ChatOptions): Promise<ChatResult>;
}

/** Error thrown when an assistant request cannot complete. */
export class AssistantError extends Error {
  constructor(
    message: string,
    /** Machine-readable code, e.g. "rate_limited", "no_token". */
    public readonly code?: string,
    /** HTTP status when the failure came from the network. */
    public readonly status?: number
  ) {
    super(message);
    this.name = "AssistantError";
  }
}
