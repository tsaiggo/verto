// Assistant provider selector + build-time configuration.
//
// Mirrors `lib/content-source/index.ts`: a single place that reads the public
// build env and resolves which assistant backend (if any) is active. The UI
// calls `getAssistantConfig()` to decide whether to render, then
// `createAssistantProvider()` once it has a token / key.

import type { AssistantProvider } from "./types";
import { AssistantError } from "./types";
import type { FetchLike } from "@/lib/tauri";
import { createGitHubModelsProvider, DEFAULT_GITHUB_MODEL } from "./github-copilot";
import { createMockProvider } from "./mock";

/** Which assistant backend is configured. "none" disables the feature. */
export type AssistantKind = "none" | "github" | "mock";

export interface AssistantConfig {
  /** The selected backend. */
  kind: AssistantKind;
  /** The default model id to send requests to. */
  model: string;
  /** Convenience flag — true when a real backend is configured. */
  enabled: boolean;
}

export interface AssistantEnvOverrides {
  /** Raw `NEXT_PUBLIC_VERTO_ASSISTANT` value. */
  assistant?: string;
  /** Raw `NEXT_PUBLIC_VERTO_ASSISTANT_MODEL` value. */
  model?: string;
}

/**
 * Resolve the active assistant configuration from the public build env.
 *
 * `NEXT_PUBLIC_*` vars are inlined by Next at build time when accessed as a
 * static member expression, so we read them directly here. Tests pass explicit
 * overrides to exercise the logic without touching the environment.
 */
export function getAssistantConfig(overrides?: AssistantEnvOverrides): AssistantConfig {
  const rawKind = (overrides?.assistant ?? process.env.NEXT_PUBLIC_VERTO_ASSISTANT ?? "")
    .trim()
    .toLowerCase();
  const model =
    (overrides?.model ?? process.env.NEXT_PUBLIC_VERTO_ASSISTANT_MODEL ?? "").trim() ||
    DEFAULT_GITHUB_MODEL;

  // Accept a few friendly aliases for the GitHub backend.
  const kind: AssistantKind =
    rawKind === "github" || rawKind === "copilot" || rawKind === "github-models"
      ? "github"
      : rawKind === "mock"
        ? "mock"
        : "none";

  return { kind, model, enabled: kind !== "none" };
}

export interface CreateProviderOptions {
  kind: AssistantKind;
  /** Credential — a GitHub token for the "github" backend. */
  token: string;
  /** Model override; falls back to the backend default. */
  model?: string;
  /** Injected fetch (Tauri HTTP in prod, mock in tests). */
  fetchImpl: FetchLike;
}

/**
 * Construct the provider for a resolved backend. Throws on an unknown or
 * disabled backend so callers can surface a clear message.
 */
export function createAssistantProvider(opts: CreateProviderOptions): AssistantProvider {
  switch (opts.kind) {
    case "github":
      return createGitHubModelsProvider({
        token: opts.token,
        model: opts.model,
        fetchImpl: opts.fetchImpl,
      });
    case "mock":
      return createMockProvider();
    case "none":
      throw new AssistantError(
        "The AI assistant is not configured. Set NEXT_PUBLIC_VERTO_ASSISTANT.",
        "disabled"
      );
    default: {
      // Exhaustiveness guard for future backends.
      const exhaustive: never = opts.kind;
      throw new AssistantError(
        `Unknown assistant backend: ${String(exhaustive)}`,
        "unknown_provider"
      );
    }
  }
}

export { DEFAULT_GITHUB_MODEL } from "./github-copilot";
export type { AssistantProvider, ChatMessage, ChatOptions, ChatResult } from "./types";
export { AssistantError } from "./types";
