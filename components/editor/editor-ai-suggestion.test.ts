import { describe, expect, it, vi } from "vitest";

import type { AssistantProvider, ChatMessage, ChatOptions, ChatResult } from "@/lib/ai";

import {
  EditorSuggestionError,
  proposalFromResponse,
  requestEditorSuggestion,
  type EditorSuggestionInput,
} from "./editor-ai-suggestion";

const input: EditorSuggestionInput = {
  source: "# Draft\n\nA quiet opening.\n",
  instruction: "Make the opening more direct.",
  filename: "draft.mdx",
  format: "mdx",
  revision: 4,
};

function providerWith(
  implementation: (messages: ChatMessage[], options?: ChatOptions) => Promise<ChatResult>
): AssistantProvider {
  return {
    id: "test",
    model: "test-model",
    chat: implementation,
  };
}

describe("editor AI suggestion validation", () => {
  it("builds one exact replacement and a reviewable diff", () => {
    const proposal = proposalFromResponse(
      input,
      '```json\n{"summary":"Uses a direct opening","oldText":"A quiet opening.","newText":"Start with the core claim."}\n```'
    );

    expect(proposal.afterSource).toBe("# Draft\n\nStart with the core claim.\n");
    expect(proposal.beforeSource).toBe(input.source);
    expect(proposal.baseRevision).toBe(4);
    expect(proposal.startLine).toBe(3);
    expect(proposal.endLine).toBe(3);
    expect(proposal.diffLines).toEqual([
      { kind: "removed", value: "A quiet opening." },
      { kind: "added", value: "Start with the core claim." },
    ]);
  });

  it("rejects a passage that is not in the captured draft", () => {
    expect(() =>
      proposalFromResponse(
        input,
        '{"summary":"Changes a missing passage","oldText":"Not here","newText":"Replacement"}'
      )
    ).toThrowError(
      expect.objectContaining<Partial<EditorSuggestionError>>({
        code: "no-match",
      })
    );
  });

  it("rejects an ambiguous replacement instead of guessing", () => {
    expect(() =>
      proposalFromResponse(
        { ...input, source: "Repeat.\n\nRepeat.\n" },
        '{"summary":"Changes one repeat","oldText":"Repeat.","newText":"Changed."}'
      )
    ).toThrowError(
      expect.objectContaining<Partial<EditorSuggestionError>>({
        code: "ambiguous-match",
      })
    );
  });

  it("rejects malformed and no-op provider responses", () => {
    expect(() => proposalFromResponse(input, "Here is your improved draft.")).toThrowError(
      expect.objectContaining<Partial<EditorSuggestionError>>({
        code: "invalid-response",
      })
    );
    expect(() =>
      proposalFromResponse(
        input,
        '{"summary":"No change","oldText":"A quiet opening.","newText":"A quiet opening."}'
      )
    ).toThrowError(
      expect.objectContaining<Partial<EditorSuggestionError>>({
        code: "unchanged",
      })
    );
  });

  it("represents a deletion without inventing an added line", () => {
    const proposal = proposalFromResponse(
      input,
      '{"summary":"Removes the opening","oldText":"A quiet opening.\\n","newText":""}'
    );

    expect(proposal.addedLineCount).toBe(0);
    expect(proposal.removedLineCount).toBe(1);
    expect(proposal.diffLines).toEqual([{ kind: "removed", value: "A quiet opening." }]);
  });

  it("grounds the provider request in the current file and forwards cancellation", async () => {
    const chat = vi.fn(
      async (_messages: ChatMessage[], _options?: ChatOptions): Promise<ChatResult> => {
        void _messages;
        void _options;
        return {
          content:
            '{"summary":"Uses a direct opening","oldText":"A quiet opening.","newText":"Start here."}',
          model: "test-model",
        };
      }
    );
    const controller = new AbortController();

    const proposal = await requestEditorSuggestion(input, providerWith(chat), controller.signal);

    expect(proposal.afterSource).toContain("Start here.");
    expect(chat).toHaveBeenCalledOnce();
    const [messages, options] = chat.mock.calls[0] ?? [];
    expect(messages?.[0]?.role).toBe("system");
    expect(messages?.[1]?.content).toContain('"filename":"draft.mdx"');
    expect(messages?.[1]?.content).toContain("# Draft");
    expect(options).toMatchObject({
      signal: controller.signal,
      temperature: 0.1,
      maxTokens: 2_000,
    });
  });

  it("turns provider failures into a recoverable request error", async () => {
    const provider = providerWith(async () => {
      throw new Error("network internals");
    });

    await expect(requestEditorSuggestion(input, provider)).rejects.toMatchObject({
      code: "request-failed",
      message:
        "The suggestion could not be generated. Check your connection and provider settings, then try again.",
    });
  });
});
