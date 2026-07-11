import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  loadThreads,
  createThread,
  deleteThread,
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

  it("creates a thread with a given title", () => {
    const store = createTestStore();
    const t = createThread("My Chat", store);
    expect(t.title).toBe("My Chat");
    expect(t.messages).toEqual([]);
    expect(t.id).toBeTruthy();
    expect(t.createdAt).toBeTruthy();
    expect(t.updatedAt).toBe(t.createdAt);
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
