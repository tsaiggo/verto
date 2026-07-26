// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentThreadData, AgentThreadMessage } from "@/lib/agent-threads";
import type { StateStore } from "@/lib/state-store";

const selectedStore = vi.hoisted(() => ({ current: null as unknown }));
const getAgentReplyMock = vi.hoisted(() => vi.fn());
const toastMocks = vi.hoisted(() => ({ show: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/state-store", () => ({
  getStateStore: () => selectedStore.current,
}));

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

vi.mock("sonner", () => ({
  toast: Object.assign(toastMocks.show, { error: toastMocks.error }),
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
    toastMocks.show.mockReset();
    toastMocks.error.mockReset();
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
    vi.unstubAllGlobals();
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
    const secondThread = host.querySelector<HTMLButtonElement>(
      "button[aria-label='Second thread']"
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

  it("consumes a URL prompt into the current composer only once", async () => {
    const vault = makeStore([makeThread("thread-one", "First thread")]);
    selectedStore.current = vault;
    window.history.replaceState({}, "", "/agent?prompt=Explain%20the%20source&view=focused");

    const { host, root } = await renderWorkspace();
    const input = host.querySelector<HTMLInputElement>("input[aria-label='Message the agent']");
    expect(input?.value).toBe("Explain the source");
    expect(new URLSearchParams(window.location.search).get("prompt")).toBeNull();
    expect(new URLSearchParams(window.location.search).get("view")).toBe("focused");

    if (input) input.value = "";
    const newChat = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("New Chat")
    );
    await act(async () => newChat?.click());
    expect(
      host.querySelector<HTMLInputElement>("input[aria-label='Message the agent']")?.value
    ).toBe("");
    act(() => root.unmount());
  });

  it("stops an active request and offers prompt recovery", async () => {
    const vault = makeStore([makeThread("thread-one", "First thread")]);
    selectedStore.current = vault;
    const pending = deferredReply();
    getAgentReplyMock.mockReturnValueOnce(pending.promise);
    const { host, root } = await renderWorkspace();

    await send(host, "Stop this request");
    const signal = getAgentReplyMock.mock.calls[0]?.[0].signal as AbortSignal;
    const stop = host.querySelector<HTMLButtonElement>("button[aria-label='Stop Agent response']");
    expect(stop).not.toBeNull();
    await act(async () => stop?.click());

    expect(signal.aborted).toBe(true);
    expect(vault.snapshot()[0]?.messages).toEqual([]);
    expect(host.textContent).toContain("The Agent stopped before completing this request.");

    const restore = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Restore prompt")
    );
    await act(async () => restore?.click());
    expect(
      host.querySelector<HTMLInputElement>("input[aria-label='Message the agent']")?.value
    ).toBe("Stop this request");
    expect(host.textContent).not.toContain("The Agent stopped before completing this request.");
    act(() => root.unmount());
  });

  it("retries a failed request without persisting a fake Agent error message", async () => {
    const vault = makeStore([makeThread("thread-one", "First thread")]);
    selectedStore.current = vault;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    getAgentReplyMock
      .mockRejectedValueOnce(new Error("provider unavailable"))
      .mockResolvedValueOnce({ id: "reply", role: "agent", text: "Recovered answer" });
    const { host, root } = await renderWorkspace();

    await send(host, "Retry this request");
    await act(async () => {
      await vi.waitFor(() =>
        expect(host.textContent).toContain("The Agent couldn’t complete this request.")
      );
    });
    expect(vault.snapshot()[0]?.messages).toEqual([]);

    const retry = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
      button.textContent?.includes("Try again")
    );
    await act(async () => retry?.click());
    await act(async () => {
      await vi.waitFor(() => expect(host.textContent).toContain("Recovered answer"));
    });
    expect(vault.snapshot()[0]?.messages.map((message) => message.role)).toEqual(["user", "agent"]);
    expect(vault.snapshot()[0]?.messages.some((message) => message.text.includes("wrong"))).toBe(
      false
    );
    consoleError.mockRestore();
    act(() => root.unmount());
  });

  it("restores a deleted conversation from the toast Undo action", async () => {
    const vault = makeStore([makeThread("thread-one", "Recover this conversation")]);
    selectedStore.current = vault;
    const { host, root } = await renderWorkspace();

    const remove = host.querySelector<HTMLButtonElement>(
      "button[aria-label='Delete Recover this conversation']"
    );
    await act(async () => remove?.click());
    expect(vault.snapshot().some((thread) => thread.id === "thread-one")).toBe(false);

    const toastOptions = toastMocks.show.mock.calls[0]?.[1] as
      | { action?: { onClick?: () => void } }
      | undefined;
    await act(async () => toastOptions?.action?.onClick?.());

    expect(vault.snapshot()).toEqual([makeThread("thread-one", "Recover this conversation")]);
    expect(host.textContent).toContain("Recover this conversation");
    act(() => root.unmount());
  });
});
