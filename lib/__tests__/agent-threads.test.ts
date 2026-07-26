import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  loadThreads,
  hydrateThreads,
  createThread,
  deleteThread,
  restoreThread,
  addMessage,
  findThread,
  renameThread,
  replaceMessages,
  threadGroup,
  fromChatMessage,
  toChatMessage,
  type AgentThreadMessage,
} from "@/lib/agent-threads";
import type { ChatMessage } from "@/lib/ai/types";

/** Minimal state-store backed by a JS Map — same pattern as agent.test.ts */
function createTestStore() {
  const map = new Map<string, string>();
  const listeners = new Set<() => void>();
  return {
    read<T>(name: string, fallback: T): T {
      const raw = map.get(`verto:${name}`);
      if (raw === undefined) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    write<T>(name: string, value: T): void {
      map.set(`verto:${name}`, JSON.stringify(value));
      listeners.forEach((fn) => fn());
    },
    async update<T>(name: string, fallback: T, updater: (current: T) => T): Promise<T> {
      const raw = map.get(`verto:${name}`);
      const current = raw === undefined ? fallback : (JSON.parse(raw) as T);
      const next = updater(current);
      map.set(`verto:${name}`, JSON.stringify(next));
      listeners.forEach((fn) => fn());
      return next;
    },
    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** Exposed for test introspection. */
    _map: map,
  };
}

beforeEach(() => {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    dispatchEvent: () => true,
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("loadThreads / createThread", () => {
  it("returns an empty list on first read", () => {
    const store = createTestStore();
    expect(loadThreads(store)).toEqual([]);
  });

  it("normalizes malformed portable thread data instead of throwing", () => {
    const store = createTestStore();
    store._map.set("verto:agent-threads", JSON.stringify({ threads: [null, {}, { id: "x" }] }));
    expect(loadThreads(store)).toEqual([]);
    store._map.set("verto:agent-threads", "null");
    expect(loadThreads(store)).toEqual([]);
  });

  it("drops malformed nested message data and unsafe citation links", () => {
    const store = createTestStore();
    store._map.set(
      "verto:agent-threads",
      JSON.stringify({
        threads: [
          {
            id: "thread",
            messages: [
              {
                id: "message",
                role: "agent",
                text: "safe text",
                toolCalls: [{ id: "ok", name: "search", args: "{}" }, { name: 3 }],
                list: [{ term: "Key", text: "Value" }, null],
                citations: [
                  {
                    index: 1,
                    label: "Safe",
                    href: "/read/safe",
                    sourceId: "source-p-1",
                    targetId: "paragraph-1",
                    excerpt: "A grounded passage.",
                    injected: "<script />",
                  },
                  {
                    index: 2,
                    label: "Safe base, unsafe anchor",
                    href: "/read/safe",
                    sourceId: "https://evil.example/source",
                    targetId: "javascript:alert(1)",
                    excerpt: "Still plain text.",
                  },
                  {},
                  { index: 3, label: "External", href: "javascript:alert(1)" },
                  { index: 4, label: "Protocol relative", href: "//evil.example" },
                ],
              },
            ],
          },
        ],
      })
    );

    const [message] = loadThreads(store)[0].messages;
    expect(message.toolCalls).toEqual([{ id: "ok", name: "search", args: "{}" }]);
    expect(message.list).toEqual([{ term: "Key", text: "Value" }]);
    expect(message.citations).toEqual([
      {
        index: 1,
        label: "Safe",
        href: "/read/safe",
        sourceId: "source-p-1",
        targetId: "paragraph-1",
        excerpt: "A grounded passage.",
      },
      {
        index: 2,
        label: "Safe base, unsafe anchor",
        href: "/read/safe",
        excerpt: "Still plain text.",
      },
    ]);
  });

  it("migrates legacy threads without scope to workspace scope", () => {
    const store = createTestStore();
    store._map.set(
      "verto:agent-threads",
      JSON.stringify({ threads: [{ id: "legacy", title: "Old", messages: [] }] })
    );

    expect(loadThreads(store)[0].scope).toEqual({ kind: "workspace" });
  });

  it("exposes an explicit hydration gate for startup writers", async () => {
    const store = createTestStore();
    const hydrate = vi.fn().mockResolvedValue(undefined);
    await hydrateThreads({ ...store, hydrate });
    expect(hydrate).toHaveBeenCalledWith("agent-threads");
  });

  it("creates a thread with a given title", () => {
    const store = createTestStore();
    const t = createThread("My Chat", store);
    expect(t.title).toBe("My Chat");
    expect(t.scope).toEqual({ kind: "workspace" });
    expect(t.messages).toEqual([]);
    expect(t.id).toBeTruthy();
    expect(t.createdAt).toBeTruthy();
    expect(t.updatedAt).toBe(t.createdAt);
  });

  it("creates and restores a document-scoped thread", () => {
    const store = createTestStore();
    const scope = {
      kind: "document" as const,
      href: "/read/guides/start",
      slug: ["guides", "start"],
      title: "Getting started",
    };
    const thread = createThread("Document chat", scope, store);

    expect(thread.scope).toEqual(scope);
    expect(findThread(thread.id, store)?.scope).toEqual(scope);
  });

  it("normalizes summary and annotation mutation receipts including undoneAt", () => {
    const store = createTestStore();
    const createdAt = "2026-07-25T08:00:00.000Z";
    const summary = {
      href: "/read/guides/start",
      slug: ["guides", "start"],
      title: "Getting started",
      body: "A grounded summary.",
      model: "agent",
      createdAt,
    };
    const annotation = {
      id: "annotation-1",
      docSlug: "guides/start",
      quote: "Grounded passage",
      anchor: { quote: "Grounded passage", prefix: "", suffix: ".", start: 12 },
      color: "yellow",
      turns: [],
      createdAt,
      updatedAt: createdAt,
    };
    store._map.set(
      "verto:agent-threads",
      JSON.stringify({
        threads: [
          {
            id: "receipts",
            messages: [
              {
                id: "summary",
                role: "tool",
                text: "Saved",
                receipt: {
                  kind: "summary.upsert",
                  before: null,
                  after: summary,
                  createdAt,
                  undoneAt: "2026-07-25T08:05:00.000Z",
                  unsafe: "removed",
                },
              },
              {
                id: "annotation",
                role: "tool",
                text: "Saved",
                receipt: {
                  kind: "annotation.create",
                  after: annotation,
                  createdAt,
                  unsafe: "removed",
                },
              },
            ],
          },
        ],
      })
    );

    const [summaryMessage, annotationMessage] = loadThreads(store)[0].messages;
    expect(summaryMessage.receipt).toEqual({
      kind: "summary.upsert",
      before: null,
      after: summary,
      createdAt,
      undoneAt: "2026-07-25T08:05:00.000Z",
    });
    expect(annotationMessage.receipt).toEqual({
      kind: "annotation.create",
      after: annotation,
      createdAt,
    });
  });

  it("drops unsafe mutation receipts without dropping the surrounding message", () => {
    const store = createTestStore();
    store._map.set(
      "verto:agent-threads",
      JSON.stringify({
        threads: [
          {
            id: "unsafe",
            messages: [
              {
                id: "message",
                role: "tool",
                text: "Untrusted portable data",
                receipt: {
                  kind: "summary.upsert",
                  before: null,
                  after: {
                    href: "https://evil.example/read",
                    slug: [],
                    title: "External",
                    body: "Do not restore",
                    model: "unknown",
                    createdAt: "2026-07-25T08:00:00.000Z",
                  },
                  createdAt: "2026-07-25T08:00:00.000Z",
                },
              },
            ],
          },
        ],
      })
    );

    expect(loadThreads(store)[0].messages[0]).toEqual({
      id: "message",
      role: "tool",
      text: "Untrusted portable data",
    });
  });

  it("persists the thread so loadThreads finds it", () => {
    const store = createTestStore();
    const t = createThread("Persist", store);
    const all = loadThreads(store);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(t.id);
  });

  it("prepends new threads so the most recent is first", () => {
    const store = createTestStore();
    const a = createThread("A", store);
    const b = createThread("B", store);
    const all = loadThreads(store);
    expect(all[0].id).toBe(b.id);
    expect(all[1].id).toBe(a.id);
  });
});

describe("deleteThread", () => {
  it("removes a thread and returns true", () => {
    const store = createTestStore();
    const t = createThread("Delete me", store);
    expect(loadThreads(store)).toHaveLength(1);
    expect(deleteThread(t.id, store)).toBe(true);
    expect(loadThreads(store)).toHaveLength(0);
  });

  it("returns false when the thread does not exist", () => {
    expect(deleteThread("nope", createTestStore())).toBe(false);
  });

  it("restores a deleted thread with its messages and timestamps intact", () => {
    const store = createTestStore();
    const thread = createThread("Recover me", store);
    addMessage(thread.id, { id: "m1", role: "user", text: "Keep this prompt" }, store);
    const snapshot = findThread(thread.id, store);
    expect(snapshot).not.toBeNull();

    expect(deleteThread(thread.id, store)).toBe(true);
    expect(restoreThread(snapshot!, store)).toBe(true);
    expect(findThread(thread.id, store)).toEqual(snapshot);
  });

  it("does not overwrite an existing thread when restore is repeated", () => {
    const store = createTestStore();
    const thread = createThread("Existing", store);

    expect(restoreThread(thread, store)).toBe(false);
    expect(loadThreads(store)).toHaveLength(1);
  });
});

describe("findThread", () => {
  it("returns the thread by id", () => {
    const store = createTestStore();
    const t = createThread("Find", store);
    expect(findThread(t.id, store)?.title).toBe("Find");
  });

  it("returns null for a missing id", () => {
    expect(findThread("missing", createTestStore())).toBeNull();
  });
});

describe("addMessage", () => {
  it("appends a message and updates updatedAt", () => {
    const store = createTestStore();
    const t = createThread("Chat", store);
    const msg: AgentThreadMessage = { id: "m1", role: "user", text: "Hello" };
    const updated = addMessage(t.id, msg, store);
    expect(updated).not.toBeNull();
    expect(updated!.messages).toHaveLength(1);
    expect(updated!.messages[0].text).toBe("Hello");
    // updatedAt advances (may be same timestamp when both ops happen in the same ms)
    expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(t.createdAt).getTime()
    );
    expect(updated!.updatedAt).toBeTruthy();
  });

  it("auto-titles the thread from the first user message", () => {
    const store = createTestStore();
    const t = createThread(undefined, store);
    expect(t.title).toBe("New Chat");
    addMessage(t.id, { id: "m1", role: "user", text: "What is Verto?" }, store);
    const reloaded = findThread(t.id, store);
    expect(reloaded!.title).toBe("What is Verto?");
  });

  it("truncates long titles", () => {
    const store = createTestStore();
    const t = createThread(undefined, store);
    const long = "A".repeat(100);
    addMessage(t.id, { id: "m1", role: "user", text: long }, store);
    expect(findThread(t.id, store)!.title.length).toBeLessThanOrEqual(60);
  });

  it("returns null when thread does not exist", () => {
    const msg: AgentThreadMessage = { id: "m1", role: "user", text: "Hi" };
    expect(addMessage("nope", msg, createTestStore())).toBeNull();
  });
});

describe("replaceMessages", () => {
  it("replaces the full message list", () => {
    const store = createTestStore();
    const t = createThread("Test", store);
    addMessage(t.id, { id: "m1", role: "user", text: "Hi" }, store);
    replaceMessages(t.id, [], store);
    expect(findThread(t.id, store)!.messages).toEqual([]);
  });
});

describe("renameThread", () => {
  it("renames the thread", () => {
    const store = createTestStore();
    const t = createThread("Old", store);
    expect(renameThread(t.id, "New", store)).toBe(true);
    expect(findThread(t.id, store)!.title).toBe("New");
  });

  it("falls back to New Chat when blank", () => {
    const store = createTestStore();
    const t = createThread("Old", store);
    renameThread(t.id, "   ", store);
    expect(findThread(t.id, store)!.title).toBe("New Chat");
  });
});

describe("threadGroup", () => {
  it("returns Today for today", () => {
    expect(threadGroup(new Date().toISOString())).toBe("Today");
  });

  it("returns Yesterday for yesterday", () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    expect(threadGroup(d.toISOString())).toBe("Yesterday");
  });

  it("returns This Week for 3 days ago", () => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    expect(threadGroup(d.toISOString())).toBe("This Week");
  });

  it("returns Older for 10 days ago", () => {
    const d = new Date();
    d.setDate(d.getDate() - 10);
    expect(threadGroup(d.toISOString())).toBe("Older");
  });
});

describe("fromChatMessage / toChatMessage", () => {
  it("converts a user message round-trip", () => {
    const chat: ChatMessage = { role: "user", content: "Hello" };
    const agent = fromChatMessage(chat);
    expect(agent.role).toBe("user");
    expect(agent.text).toBe("Hello");
    const back = toChatMessage(agent);
    expect(back.role).toBe("user");
    expect(back.content).toBe("Hello");
  });

  it("converts an assistant message to agent role", () => {
    const chat: ChatMessage = { role: "assistant", content: "Reply" };
    const agent = fromChatMessage(chat, [{ term: "K", text: "V" }]);
    expect(agent.role).toBe("agent");
    expect(agent.list).toHaveLength(1);
  });

  it("converts a persisted agent message back to the assistant provider role", () => {
    const persisted: AgentThreadMessage = { id: "m1", role: "agent", text: "Reply" };

    expect(toChatMessage(persisted)).toEqual({ role: "assistant", content: "Reply" });
  });

  it("converts a tool message preserving toolCallId", () => {
    const chat: ChatMessage = { role: "tool", content: "result", toolCallId: "tc1" };
    const agent = fromChatMessage(chat);
    expect(agent.role).toBe("tool");
    expect(agent.toolCallId).toBe("tc1");
  });

  it("preserves toolCalls through the conversion", () => {
    const tools = [{ id: "c1", name: "search_doc", args: '{"query":"x"}' }];
    const chat: ChatMessage = { role: "assistant", content: "", toolCalls: tools };
    const agent = fromChatMessage(chat);
    expect(agent.toolCalls).toEqual(tools);
    const back = toChatMessage(agent);
    expect(back.toolCalls).toEqual(tools);
  });
});
