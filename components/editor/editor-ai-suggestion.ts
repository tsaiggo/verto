import {
  AssistantError,
  createAssistantProvider,
  getAssistantConfig,
  type AssistantProvider,
  type ChatMessage,
} from "@/lib/ai";
import { loadWebKey } from "@/lib/ai/key-store";
import { tauriFetch } from "@/lib/tauri";

const MAX_INSTRUCTION_LENGTH = 1_200;
const MAX_SOURCE_LENGTH = 200_000;
const MAX_RESPONSE_LENGTH = 40_000;

export type EditorSuggestionErrorCode =
  | "unconfigured"
  | "missing-key"
  | "invalid-request"
  | "invalid-response"
  | "no-match"
  | "ambiguous-match"
  | "unchanged"
  | "request-failed";

export class EditorSuggestionError extends Error {
  constructor(
    message: string,
    public readonly code: EditorSuggestionErrorCode
  ) {
    super(message);
    this.name = "EditorSuggestionError";
  }
}

export interface EditorSuggestionInput {
  source: string;
  instruction: string;
  filename: string;
  format: "md" | "mdx";
  revision: number;
}

export interface EditorSuggestionDiffLine {
  kind: "removed" | "added";
  value: string;
}

export interface EditorEditProposal {
  request: string;
  summary: string;
  beforeSource: string;
  afterSource: string;
  oldText: string;
  newText: string;
  filename: string;
  format: "md" | "mdx";
  baseRevision: number;
  startLine: number;
  endLine: number;
  addedLineCount: number;
  removedLineCount: number;
  diffLines: EditorSuggestionDiffLine[];
}

export type EditorSuggestionAvailability =
  | { kind: "ready" }
  | { kind: "unconfigured"; message: string }
  | { kind: "missing-key"; message: string };

export interface EditorSuggestionClient {
  availability(): EditorSuggestionAvailability | Promise<EditorSuggestionAvailability>;
  request(input: EditorSuggestionInput, signal?: AbortSignal): Promise<EditorEditProposal>;
}

interface SuggestionPayload {
  summary: string;
  oldText: string;
  newText: string;
}

function cleanModelResponse(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace
    ? trimmed.slice(firstBrace, lastBrace + 1)
    : trimmed;
}

function parseSuggestionPayload(content: string): SuggestionPayload {
  if (!content.trim() || content.length > MAX_RESPONSE_LENGTH) {
    throw new EditorSuggestionError(
      "The provider returned an empty or oversized suggestion.",
      "invalid-response"
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(cleanModelResponse(content));
  } catch {
    throw new EditorSuggestionError(
      "The provider response was not a verifiable edit. Try a more specific request.",
      "invalid-response"
    );
  }

  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    typeof (value as Record<string, unknown>).summary !== "string" ||
    typeof (value as Record<string, unknown>).oldText !== "string" ||
    typeof (value as Record<string, unknown>).newText !== "string"
  ) {
    throw new EditorSuggestionError(
      "The provider response did not contain a complete edit.",
      "invalid-response"
    );
  }

  const payload = value as SuggestionPayload;
  if (!payload.summary.trim() || !payload.oldText) {
    throw new EditorSuggestionError(
      "The provider response did not identify a concrete passage to change.",
      "invalid-response"
    );
  }
  if (payload.oldText === payload.newText) {
    throw new EditorSuggestionError("The suggestion would not change the draft.", "unchanged");
  }
  return {
    summary: payload.summary.trim(),
    oldText: payload.oldText,
    newText: payload.newText,
  };
}

function matchingOffsets(source: string, needle: string): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  while (cursor <= source.length - needle.length) {
    const offset = source.indexOf(needle, cursor);
    if (offset < 0) break;
    offsets.push(offset);
    if (offsets.length > 1) break;
    cursor = offset + Math.max(1, needle.length);
  }
  return offsets;
}

function lines(value: string): string[] {
  return value.split(/\r\n|\n|\r/);
}

function changedLines(value: string): string[] {
  if (!value) return [];
  const result = lines(value);
  if (result.length > 1 && result[result.length - 1] === "") result.pop();
  return result;
}

export function proposalFromResponse(
  input: EditorSuggestionInput,
  responseContent: string
): EditorEditProposal {
  const payload = parseSuggestionPayload(responseContent);
  const offsets = matchingOffsets(input.source, payload.oldText);
  if (offsets.length === 0) {
    throw new EditorSuggestionError(
      "The suggested passage no longer matches this draft. Request a fresh suggestion.",
      "no-match"
    );
  }
  if (offsets.length > 1) {
    throw new EditorSuggestionError(
      "The suggested passage appears more than once, so Verto cannot apply it safely.",
      "ambiguous-match"
    );
  }

  const offset = offsets[0];
  const afterSource =
    input.source.slice(0, offset) +
    payload.newText +
    input.source.slice(offset + payload.oldText.length);
  const startLine = lines(input.source.slice(0, offset)).length;
  const removed = changedLines(payload.oldText);
  const added = changedLines(payload.newText);

  return {
    request: input.instruction.trim(),
    summary: payload.summary,
    beforeSource: input.source,
    afterSource,
    oldText: payload.oldText,
    newText: payload.newText,
    filename: input.filename,
    format: input.format,
    baseRevision: input.revision,
    startLine,
    endLine: startLine + Math.max(1, removed.length) - 1,
    addedLineCount: added.length,
    removedLineCount: removed.length,
    diffLines: [
      ...removed.map((value) => ({ kind: "removed" as const, value })),
      ...added.map((value) => ({ kind: "added" as const, value })),
    ],
  };
}

function validateInput(input: EditorSuggestionInput): void {
  const instruction = input.instruction.trim();
  if (!instruction) {
    throw new EditorSuggestionError("Describe the change you want to review.", "invalid-request");
  }
  if (instruction.length > MAX_INSTRUCTION_LENGTH) {
    throw new EditorSuggestionError(
      `Keep the edit request under ${MAX_INSTRUCTION_LENGTH.toLocaleString()} characters.`,
      "invalid-request"
    );
  }
  if (!input.source.trim()) {
    throw new EditorSuggestionError(
      "Add some Markdown before requesting an edit.",
      "invalid-request"
    );
  }
  if (input.source.length > MAX_SOURCE_LENGTH) {
    throw new EditorSuggestionError(
      "This draft is too large for a safe single-pass suggestion. Select a smaller document.",
      "invalid-request"
    );
  }
}

function suggestionMessages(input: EditorSuggestionInput): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You edit a local Markdown or MDX draft. Return JSON only with exactly three string fields: " +
        '{"summary":"short impact explanation","oldText":"one exact unique contiguous passage copied verbatim from source","newText":"replacement passage"}. ' +
        "Make one focused change. Preserve frontmatter, Markdown syntax, MDX components, whitespace, and the document voice unless the request requires changing them. " +
        "Never return a full document when a smaller unique passage can be replaced. Do not use markdown fences.",
    },
    {
      role: "user",
      content: JSON.stringify({
        request: input.instruction.trim(),
        filename: input.filename,
        format: input.format,
        source: input.source,
      }),
    },
  ];
}

function requestFailure(error: unknown): never {
  if (error instanceof EditorSuggestionError) throw error;
  if (error instanceof DOMException && error.name === "AbortError") throw error;

  if (error instanceof AssistantError) {
    if (error.code === "no_token" || error.status === 401 || error.status === 403) {
      throw new EditorSuggestionError(
        "The provider rejected the saved access key. Update it in AI & Agent settings.",
        "missing-key"
      );
    }
    if (error.code === "rate_limited" || error.status === 429) {
      throw new EditorSuggestionError(
        "The AI provider is rate limited. Wait a moment, then try again.",
        "request-failed"
      );
    }
  }

  throw new EditorSuggestionError(
    "The suggestion could not be generated. Check your connection and provider settings, then try again.",
    "request-failed"
  );
}

export async function requestEditorSuggestion(
  input: EditorSuggestionInput,
  provider: AssistantProvider,
  signal?: AbortSignal
): Promise<EditorEditProposal> {
  validateInput(input);
  try {
    const result = await provider.chat(suggestionMessages(input), {
      signal,
      temperature: 0.1,
      maxTokens: 2_000,
    });
    return proposalFromResponse(input, result.content);
  } catch (error) {
    return requestFailure(error);
  }
}

export function defaultEditorSuggestionAvailability(): EditorSuggestionAvailability {
  const config = getAssistantConfig();
  if (!config.enabled) {
    return {
      kind: "unconfigured",
      message: "Choose an AI provider in Settings before requesting an edit.",
    };
  }
  if (config.kind === "github" && !loadWebKey()) {
    return {
      kind: "missing-key",
      message: "Add a provider access key in AI & Agent settings to review edits.",
    };
  }
  return { kind: "ready" };
}

export const defaultEditorSuggestionClient: EditorSuggestionClient = {
  availability: defaultEditorSuggestionAvailability,
  async request(input, signal) {
    const config = getAssistantConfig();
    if (!config.enabled) {
      throw new EditorSuggestionError(
        "Choose an AI provider in Settings before requesting an edit.",
        "unconfigured"
      );
    }
    const token = config.kind === "mock" ? "mock" : loadWebKey();
    if (!token) {
      throw new EditorSuggestionError(
        "Add a provider access key in AI & Agent settings to review edits.",
        "missing-key"
      );
    }
    const fetchImpl = await tauriFetch();
    const provider = createAssistantProvider({
      kind: config.kind,
      token,
      model: config.model,
      fetchImpl,
    });
    return requestEditorSuggestion(input, provider, signal);
  },
};
