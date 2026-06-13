// Shared types for the AI assistant layer.
//
// Verto's assistant is built around a small, pluggable `AssistantProvider`
// interface — mirroring the `ContentSource` abstraction used for content. A
// provider takes a list of chat messages and returns the model's reply. The
// concrete GitHub Models / Copilot implementation lives in `github-copilot.ts`;
// new backends can be added without touching the UI.

/** Who authored a chat message. */
export type ChatRole = "system" | "user" | "assistant";

/** A single message in a chat conversation (OpenAI-compatible shape). */
export interface ChatMessage {
  role: ChatRole;
  content: string;
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
