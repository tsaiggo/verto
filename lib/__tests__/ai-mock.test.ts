import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockProvider } from "@/lib/ai/mock";
import { runAgent } from "@/lib/ai/agent";
import { READING_TOOLS, readingToolCtx } from "@/lib/ai/tools/library";
import type { ChatMessage } from "@/lib/ai/types";
import { loadSummaries } from "@/lib/summaries";

async function resolveAfter<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  await vi.advanceTimersByTimeAsync(milliseconds);
  return promise;
}

describe("mock assistant provider", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        removeItem: (key: string) => void store.delete(key),
        setItem: (key: string, value: string) => void store.set(key, value),
      },
      dispatchEvent: () => true,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("exposes a deterministic offline provider identity", () => {
    const provider = createMockProvider();

    expect(provider.id).toBe("mock");
    expect(provider.model).toBe("mock/preview");
  });

  it("tightens a selected passage", async () => {
    const provider = createMockProvider();
    const messages: ChatMessage[] = [
      {
        role: "user",
        content:
          "Improve this.\n--- PASSAGE ---\nThis is really just a sentence, in order to help.",
      },
    ];

    const result = await resolveAfter(provider.chat(messages), 500);

    expect(result).toEqual({ content: "This is a sentence, help.", model: "mock/preview" });
  });

  it("marks an already concise passage as tightened", async () => {
    const provider = createMockProvider();
    const result = await resolveAfter(
      provider.chat([{ role: "user", content: "--- PASSAGE ---\nConcise text." }]),
      500
    );

    expect(result.content).toBe("Concise text. (tightened)");
  });

  it("returns the demo reply when no passage is selected", async () => {
    const provider = createMockProvider();
    const result = await resolveAfter(
      provider.chat([{ role: "user", content: "What is this document about?" }]),
      500
    );

    expect(result.content).toContain("mocked reply for the local demo");
    expect(result.model).toBe("mock/preview");
  });

  it("keeps a direct document summary read-only", async () => {
    const provider = createMockProvider();
    const result = await resolveAfter(
      provider.agentChat!([{ role: "user", content: "Summarize the document" }], []),
      600
    );

    expect(result.content).toContain("## TL;DR");
    expect(result.content).toContain("no library item was created");
    expect(result.content).not.toContain("Want me to save");
    expect(result.toolCalls).toBeUndefined();
  });

  it("routes the saved-summary starter to save_summary", async () => {
    const provider = createMockProvider();
    const result = await resolveAfter(
      provider.agentChat!(
        [
          {
            role: "user",
            content:
              "Draft a concise summary of this document, then ask me before saving it to my library.",
          },
        ],
        []
      ),
      600
    );

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls?.[0]).toMatchObject({
      id: "mock-1",
      name: "save_summary",
    });
    const args = JSON.parse(result.toolCalls?.[0].args ?? "{}") as { body?: string };
    expect(args.body).toContain("## Summary");
    expect(result.toolCalls?.[0].name).not.toBe("create_highlight_note");
  });

  it("routes note review through list_notes and grounds the answer in its result", async () => {
    const provider = createMockProvider();
    const request = await resolveAfter(
      provider.agentChat!(
        [
          {
            role: "user",
            content:
              "Review the highlights and notes I have saved for this document. Group them by theme and call out gaps.",
          },
        ],
        []
      ),
      600
    );

    expect(request.toolCalls?.[0]).toMatchObject({ name: "list_notes", args: "{}" });
    const result = await resolveAfter(
      provider.agentChat!(
        [
          { role: "user", content: "Review my notes" },
          {
            role: "assistant",
            content: request.content,
            toolCalls: request.toolCalls,
          },
          {
            role: "tool",
            toolCallId: request.toolCalls?.[0].id,
            content: '• "Folder is the source of truth" (Keep this constraint.)',
          },
        ],
        []
      ),
      600
    );

    expect(result.content).toContain('"Folder is the source of truth"');
    expect(result.content).toContain("**Theme**");
    expect(result.content).toContain("**Gap**");
    expect(result.toolCalls).toBeUndefined();
  });

  it("returns an honest empty-state after list_notes", async () => {
    const provider = createMockProvider();
    const result = await resolveAfter(
      provider.agentChat!(
        [
          {
            role: "assistant",
            content: "I'll review the notes saved for this document.",
            toolCalls: [{ id: "mock-1", name: "list_notes", args: "{}" }],
          },
          { role: "tool", toolCallId: "mock-1", content: "No notes yet." },
        ],
        []
      ),
      600
    );

    expect(result.content).toBe(
      "You don't have any saved highlights or notes for this document yet."
    );
  });

  it("requests a highlight tool call with the quoted passage", async () => {
    const provider = createMockProvider();
    const result = await resolveAfter(
      provider.agentChat!([{ role: "user", content: 'Highlight "the first paragraph"' }], []),
      600
    );

    expect(result.content).toContain("highlight that passage");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls?.[0]).toMatchObject({
      id: "mock-1",
      name: "create_highlight_note",
    });
    expect(JSON.parse(result.toolCalls?.[0].args ?? "{}")).toEqual({
      quote: "the first paragraph",
      note: "Worth revisiting.",
    });
  });

  it("uses a safe fallback quote for explicit note writes without quoted text", async () => {
    const provider = createMockProvider();
    const result = await resolveAfter(
      provider.agentChat!([{ role: "user", content: "保存一个笔记" }], []),
      600
    );

    expect(JSON.parse(result.toolCalls?.[0].args ?? "{}").quote).toBe("reading companion");
  });

  it.each([
    [
      "save_summary",
      "Summary saved.",
      "Saved. The summary is now available in your library and Studio.",
    ],
    [
      "create_highlight_note",
      "Highlight saved.",
      "Done. I highlighted that passage and saved the note.",
    ],
  ])("uses the %s completion copy", async (name, toolResult, expected) => {
    const provider = createMockProvider();
    const result = await resolveAfter(
      provider.agentChat!(
        [
          {
            role: "assistant",
            content: "Ready to run.",
            toolCalls: [{ id: "mock-1", name, args: "{}" }],
          },
          { role: "tool", toolCallId: "mock-1", content: toolResult },
        ],
        []
      ),
      600
    );

    expect(result.content).toBe(expected);
    expect(result.toolCalls).toBeUndefined();
  });

  it("confirms and persists the saved-summary starter through the agent loop", async () => {
    const provider = createMockProvider();
    const confirm = vi.fn().mockResolvedValue(true);
    const promise = runAgent(
      provider,
      READING_TOOLS,
      [
        {
          role: "user",
          content:
            "Draft a concise summary of this document, then ask me before saving it to my library.",
        },
      ],
      readingToolCtx({
        href: "/demo",
        slug: ["demo"],
        title: "Demo",
        body: "A document about Verto.",
      }),
      { confirm }
    );

    await vi.advanceTimersByTimeAsync(600);
    await vi.advanceTimersByTimeAsync(600);
    const result = await promise;

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ name: "save_summary" }));
    expect(result.steps).toEqual([
      expect.objectContaining({ name: "save_summary", ok: true, result: "Summary saved." }),
    ]);
    expect(result.content).toBe("Saved. The summary is now available in your library and Studio.");
    expect(loadSummaries().summaries[0]).toMatchObject({
      href: "/demo",
      title: "Demo",
    });
  });
});
