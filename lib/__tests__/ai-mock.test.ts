import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockProvider } from "@/lib/ai/mock";
import type { ChatMessage } from "@/lib/ai/types";

async function resolveAfter<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  await vi.advanceTimersByTimeAsync(milliseconds);
  return promise;
}

describe("mock assistant provider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("returns a grounded overview for read-only agent questions", async () => {
    const provider = createMockProvider();
    const result = await resolveAfter(
      provider.agentChat!([{ role: "user", content: "Summarize the document" }], []),
      600
    );

    expect(result.content).toContain("## TL;DR");
    expect(result.toolCalls).toBeUndefined();
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

  it("uses a safe fallback quote for write requests without quoted text", async () => {
    const provider = createMockProvider();
    const result = await resolveAfter(
      provider.agentChat!([{ role: "user", content: "保存一个笔记" }], []),
      600
    );

    expect(JSON.parse(result.toolCalls?.[0].args ?? "{}").quote).toBe("reading companion");
  });

  it("acknowledges a completed tool result", async () => {
    const provider = createMockProvider();
    const result = await resolveAfter(
      provider.agentChat!([{ role: "tool", content: "saved", toolCallId: "mock-1" }], []),
      600
    );

    expect(result.content).toBe("Done. I highlighted that passage and saved a note for you.");
    expect(result.toolCalls).toBeUndefined();
  });
});
