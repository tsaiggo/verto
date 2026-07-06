import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { runAgent } from "@/lib/ai/agent";
import { READING_TOOLS, readingToolCtx } from "@/lib/ai/tools/library";
import { dispatch } from "@/lib/ai/tools/registry";
import type { AssistantProvider, ChatResult } from "@/lib/ai/types";
import { loadAnnotations } from "@/lib/annotations";
import { loadSummaries } from "@/lib/summaries";

const doc = { href: "/read/x", slug: ["x"], title: "X", body: "Alpha beta. Gamma delta." };
const ctx = readingToolCtx(doc);

function scripted(steps: ChatResult[]): AssistantProvider {
  let i = 0;
  return {
    id: "scripted",
    model: "scripted/1",
    async chat(): Promise<ChatResult> {
      return { content: "done", model: "scripted/1" };
    },
    async agentChat(): Promise<ChatResult> {
      return steps[Math.min(i++, steps.length - 1)];
    },
  };
}

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
    dispatchEvent: () => true,
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("tool dispatch", () => {
  it("reads the current document", async () => {
    const r = await dispatch(READING_TOOLS, "get_current_doc", "{}", ctx);
    expect(r).toMatchObject({ ok: true });
  });

  it("rejects an unknown tool", async () => {
    const r = await dispatch(READING_TOOLS, "nope", "{}", ctx);
    expect(r.ok).toBe(false);
  });

  it("fails when a quote is not in the document", async () => {
    const r = await dispatch(READING_TOOLS, "create_highlight_note", '{"quote":"missing"}', ctx);
    expect(r.ok).toBe(false);
  });

  it("saves a highlight for an exact quote", async () => {
    const r = await dispatch(
      READING_TOOLS,
      "create_highlight_note",
      '{"quote":"Alpha beta."}',
      ctx
    );
    expect(r).toMatchObject({ ok: true });
    expect(loadAnnotations().annotations).toHaveLength(1);
  });
});

describe("runAgent", () => {
  it("returns the model reply when no tools are called", async () => {
    const p = scripted([{ content: "hi", model: "scripted/1", toolCalls: [] }]);
    const r = await runAgent(p, READING_TOOLS, [], ctx);
    expect(r.content).toBe("hi");
  });

  it("declines a write unless confirmed, then approves", async () => {
    const call = [{ id: "c1", name: "save_summary", args: '{"body":"TL;DR"}' }];
    const p = scripted([
      { content: "", model: "scripted/1", toolCalls: call },
      { content: "saved", model: "scripted/1", toolCalls: [] },
    ]);
    const declined = await runAgent(p, READING_TOOLS, [], ctx, { confirm: async () => false });
    expect(loadSummaries().summaries).toHaveLength(0);
    expect(declined.steps[0].ok).toBe(false);

    const ok = await runAgent(
      scripted([
        { content: "", model: "scripted/1", toolCalls: call },
        { content: "saved", model: "scripted/1", toolCalls: [] },
      ]),
      READING_TOOLS,
      [],
      ctx,
      { confirm: async () => true }
    );
    expect(loadSummaries().summaries).toHaveLength(1);
    expect(ok.content).toBe("saved");
  });
});
