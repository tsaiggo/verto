// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentThreadData, AgentThreadMessage } from "@/lib/agent-threads";
import type { StateStore } from "@/lib/state-store";

const selectedStore = vi.hoisted(() => ({ current: null as unknown }));
const getAgentReplyMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/state-store", () => ({
  getStateStore: () => selectedStore.current,
}));

vi.mock("sonner", () => ({ toast: { error: toastErrorMock } }));

vi.mock("@/lib/ai/key-store", () => ({ loadWebKey: () => null }));

vi.mock("@/components/runtime/useRuntimeLocalIndex", () => ({
  useRuntimeLocalIndex: () => ({ status: "idle" as const }),
}));

vi.mock("@/components/agent/agent-replies", () => ({
  getAgentReply: getAgentReplyMock,
  agentReply: (store: typeof import("@/lib/agent-threads"), text: string) => ({
    id: store.newId(),
    role: "agent" as const,
    text,
  }),
}));

import AgentWorkspace from "./AgentWorkspace";
import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

interface TestStore extends StateStore {
  snapshot(): AgentThreadData[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeThread(id: string, title: string): AgentThreadData {
  const now = "2026-07-15T00:00:00.000Z";
  return { id, title, messages: [], createdAt: now, updatedAt: now };
}

function makeStore(initialThreads: AgentThreadData[]): TestStore {
  let value = { threads: clone(initialThreads) };
  const listeners = new Set<() => void>();
  return {
    read<T>(_name: string, fallback: T): T {
      return (value ?? fallback) as T;
    },
    async hydrate() {},
    async update<T>(_name: string, fallback: T, updater: (current: T) => T): Promise<T> {
      const next = updater((value ?? fallback) as T);
      value = clone(next) as typeof value;
      listeners.forEach((listener) => listener());
      return next;
    },
    write<T>(_name: string, next: T) {
      value = clone(next) as typeof value;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot() {
      return clone(value.threads);
    },
  };
}

function deferredReply() {
  let resolve!: (message: AgentThreadMessage) => void;
  const promise = new Promise<AgentThreadMessage>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function renderWorkspace(): Promise<{ host: HTMLDivElement; root: Root }> {
  // Preload the module AgentWorkspace imports from its initialization effect so
  // the resulting React state updates can settle inside the render act boundary.
  await import("@/lib/agent-threads");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(AgentWorkspace, {
        sources: [
          {
            title: "Source",
            subtitle: "Library",
            href: "/read/source",
            body: "Grounded source text",
          },
        ],
        availableSourceCount: 1,
        assistantKind: "mock",
        assistantModel: "mock",
      })
    );
  });
  await act(async () => {
    await vi.waitFor(() =>
      expect(host.querySelector("input[aria-label='Message the agent']")).not.toBeNull()
    );
  });
  return { host, root };
}

async function send(host: HTMLElement, text: string) {
  const input = host.querySelector<HTMLInputElement>("input[aria-label='Message the agent']");
  const form = input?.closest("form");
  if (!input || !form) throw new Error("Agent composer is unavailable");
  input.value = text;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("AgentWorkspace request ownership", () => {
  beforeEach(() => {
    getAgentReplyMock.mockReset();
    toastErrorMock.mockReset();
    window.history.replaceState({}, "", "/agent");
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    window.history.replaceState({}, "", "/agent");
    vi.unstubAllGlobals();
  });

  it("prefills a Search handoff without sending and consumes only the prompt parameter", async () => {
    const vault = makeStore([makeThread("thread-one", "Search handoff")]);
    selectedStore.current = vault;
    window.history.replaceState(
      { navigation: "search" },
      "",
      "/agent?prompt=Summarize%20%26%20cite%20this&panel=context#sources"
    );

    const { host, root } = await renderWorkspace();
    const input = host.querySelector<HTMLInputElement>("input[aria-label='Message the agent']");

    expect(input?.value).toBe("Summarize & cite this");
    expect(window.location.pathname).toBe("/agent");
    expect(window.location.search).toBe("?panel=context");
    expect(window.location.hash).toBe("#sources");
    expect(getAgentReplyMock).not.toHaveBeenCalled();
    expect(vault.snapshot()[0]?.messages).toEqual([]);

    act(() => root.unmount());
  });

  it("recovers an initial conversation after portable mirror persistence rejects", async () => {
    const vault = makeStore([]);
    const write = vault.write.bind(vault);
    vault.write = function failAfterLocalWrite<T>(name: string, next: T): void {
      write(name, next);
      throw new Error("portable mirror unavailable");
    };
    selectedStore.current = vault;

    const { host, root } = await renderWorkspace();

    expect(vault.snapshot()).toHaveLength(1);
    expect(vault.snapshot()[0]?.title).toBe("New Chat");
    expect(host.querySelector("input[aria-label='Message the agent']")).not.toBeNull();
    expect(toastErrorMock).not.toHaveBeenCalled();

    act(() => root.unmount());
  });

  it("does not write an old response into a new vault with the same thread id", async () => {
    const oldVault = makeStore([makeThread("shared-thread", "Old vault thread")]);
    const newVault = makeStore([makeThread("shared-thread", "New vault thread")]);
    selectedStore.current = oldVault;
    const pending = deferredReply();
    getAgentReplyMock.mockReturnValueOnce(pending.promise);
    const { host, root } = await renderWorkspace();

    await send(host, "Question from the old vault");
    const signal = getAgentReplyMock.mock.calls[0]?.[0].signal as AbortSignal;

    selectedStore.current = newVault;
    await act(async () => {
      window.dispatchEvent(new Event(LOCAL_FOLDER_CHANGED_EVENT));
    });
    await act(async () => {
      await vi.waitFor(() => expect(host.textContent).toContain("New vault thread"));
    });

    await act(async () => {
      pending.resolve({ id: "stale-reply", role: "agent", text: "Stale response" });
      await pending.promise;
    });

    expect(signal.aborted).toBe(true);
    expect(oldVault.snapshot()[0]?.messages.map((message) => message.role)).toEqual(["user"]);
    expect(newVault.snapshot()[0]?.messages).toEqual([]);
    act(() => root.unmount());
  });

  it("drops a response after the active thread changes", async () => {
    const vault = makeStore([
      makeThread("thread-one", "First thread"),
      makeThread("thread-two", "Second thread"),
    ]);
    selectedStore.current = vault;
    const pending = deferredReply();
    getAgentReplyMock.mockReturnValueOnce(pending.promise);
    const { host, root } = await renderWorkspace();

    await send(host, "Question for the first thread");
    const secondThread = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "Second thread"
    );
    expect(secondThread).toBeDefined();
    await act(async () => secondThread?.click());
    await act(async () => {
      pending.resolve({ id: "late-reply", role: "agent", text: "Late response" });
      await pending.promise;
    });

    const [first, second] = vault.snapshot();
    expect(first?.messages.map((message) => message.role)).toEqual(["user"]);
    expect(second?.messages).toEqual([]);
    act(() => root.unmount());
  });

  it("aborts and drops a response after unmount", async () => {
    const vault = makeStore([makeThread("thread-one", "First thread")]);
    selectedStore.current = vault;
    const pending = deferredReply();
    getAgentReplyMock.mockReturnValueOnce(pending.promise);
    const { host, root } = await renderWorkspace();

    await send(host, "Question before unmount");
    const signal = getAgentReplyMock.mock.calls[0]?.[0].signal as AbortSignal;
    act(() => root.unmount());
    await act(async () => {
      pending.resolve({ id: "late-reply", role: "agent", text: "Late response" });
      await pending.promise;
    });

    expect(signal.aborted).toBe(true);
    expect(vault.snapshot()[0]?.messages.map((message) => message.role)).toEqual(["user"]);
  });
  it("keeps the draft when the user message cannot be persisted", async () => {
    const vault = makeStore([makeThread("thread-one", "First thread")]);
    vault.write = function failWrite(): void {
      throw new Error("quota exceeded");
    };
    selectedStore.current = vault;
    const { host, root } = await renderWorkspace();

    await send(host, "Unsaved question");

    const input = host.querySelector<HTMLInputElement>("input[aria-label='Message the agent']");
    expect(input?.value).toBe("Unsaved question");
    expect(vault.snapshot()[0]?.messages).toEqual([]);
    expect(getAgentReplyMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith("Couldn't save message", {
      description:
        "Your message is still in the composer. Check local storage, then try sending again.",
    });

    act(() => root.unmount());
  });

  it("reports reply persistence separately from provider failure", async () => {
    const vault = makeStore([makeThread("thread-one", "First thread")]);
    const write = vault.write.bind(vault);
    let writeCount = 0;
    vault.write = function failSecondWrite<T>(name: string, next: T): void {
      writeCount += 1;
      if (writeCount === 2) throw new Error("quota exceeded");
      write(name, next);
    };
    selectedStore.current = vault;
    getAgentReplyMock.mockResolvedValueOnce({
      id: "reply-one",
      role: "agent",
      text: "Provider reply",
    });
    const { host, root } = await renderWorkspace();

    await send(host, "Persist my reply");
    await act(async () =>
      vi.waitFor(() =>
        expect(toastErrorMock).toHaveBeenCalledWith("Couldn't save Agent response", {
          description:
            "The response could not be added to this conversation. Check local storage, then retry the request.",
        })
      )
    );

    expect(vault.snapshot()[0]?.messages.map((message) => message.role)).toEqual(["user"]);

    act(() => root.unmount());
  });
  it("keeps the current conversation when creating a thread truly fails", async () => {
    const vault = makeStore([makeThread("thread-one", "First thread")]);
    vault.write = function failWrite(): void {
      throw new Error("quota exceeded");
    };
    selectedStore.current = vault;
    const { host, root } = await renderWorkspace();

    const newConversation = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes("New conversation")
    );
    await act(async () => newConversation?.click());

    expect(vault.snapshot().map((thread) => thread.id)).toEqual(["thread-one"]);
    expect(toastErrorMock).toHaveBeenCalledWith("Couldn't create conversation", {
      description: "Check local storage, then try again.",
    });

    act(() => root.unmount());
  });

  it("recovers a locally created conversation after mirror persistence rejects", async () => {
    const vault = makeStore([makeThread("thread-one", "First thread")]);
    const write = vault.write.bind(vault);
    vault.write = function failAfterLocalWrite<T>(name: string, next: T): void {
      write(name, next);
      throw new Error("portable mirror unavailable");
    };
    selectedStore.current = vault;
    const { host, root } = await renderWorkspace();

    const newConversation = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.includes("New conversation")
    );
    await act(async () => newConversation?.click());

    expect(vault.snapshot()).toHaveLength(2);
    expect(vault.snapshot()[0]?.title).toBe("New Chat");
    expect(toastErrorMock).not.toHaveBeenCalled();

    act(() => root.unmount());
  });

  it("keeps a conversation visible when deletion truly fails", async () => {
    const vault = makeStore([
      makeThread("thread-one", "First thread"),
      makeThread("thread-two", "Second thread"),
    ]);
    vault.write = function failWrite(): void {
      throw new Error("quota exceeded");
    };
    selectedStore.current = vault;
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { host, root } = await renderWorkspace();

    const deleteButton = host.querySelector<HTMLButtonElement>(
      "button[aria-label='Delete First thread']"
    );
    await act(async () => deleteButton?.click());

    expect(vault.snapshot().map((thread) => thread.id)).toEqual(["thread-one", "thread-two"]);
    expect(toastErrorMock).toHaveBeenCalledWith("Couldn't delete conversation", {
      description: "The conversation is still here. Check local storage, then try again.",
    });

    act(() => root.unmount());
  });

  it("recovers a locally deleted conversation after mirror persistence rejects", async () => {
    const vault = makeStore([
      makeThread("thread-one", "First thread"),
      makeThread("thread-two", "Second thread"),
    ]);
    const write = vault.write.bind(vault);
    vault.write = function failAfterLocalWrite<T>(name: string, next: T): void {
      write(name, next);
      throw new Error("portable mirror unavailable");
    };
    selectedStore.current = vault;
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { host, root } = await renderWorkspace();

    const deleteButton = host.querySelector<HTMLButtonElement>(
      "button[aria-label='Delete First thread']"
    );
    await act(async () => deleteButton?.click());

    expect(vault.snapshot().map((thread) => thread.id)).toEqual(["thread-two"]);
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Second thread");

    act(() => root.unmount());
  });
  it("continues when local message writes succeed but the portable mirror rejects", async () => {
    const vault = makeStore([makeThread("thread-one", "First thread")]);
    const write = vault.write.bind(vault);
    vault.write = function failAfterLocalWrite<T>(name: string, next: T): void {
      write(name, next);
      throw new Error("portable mirror unavailable");
    };
    selectedStore.current = vault;
    getAgentReplyMock.mockResolvedValueOnce({
      id: "reply-one",
      role: "agent",
      text: "Locally saved reply",
    });
    const { host, root } = await renderWorkspace();

    await send(host, "Keep this message");
    await act(async () => {
      await vi.waitFor(() =>
        expect(vault.snapshot()[0]?.messages.map((message) => message.role)).toEqual([
          "user",
          "agent",
        ])
      );
    });

    expect(getAgentReplyMock).toHaveBeenCalledOnce();
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(
      host.querySelector<HTMLInputElement>("input[aria-label='Message the agent']")?.value
    ).toBe("");

    act(() => root.unmount());
  });
});
