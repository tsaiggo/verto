// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadInbox, saveInbox, type InboxItem } from "@/lib/inbox";
import { loadSubscriptions, saveSubscriptions } from "@/lib/subscriptions";

const feeds = vi.hoisted(() => ({ sync: vi.fn() }));
vi.mock("@/lib/feeds/sync", () => ({ syncSubscriptions: feeds.sync }));
vi.mock("@/lib/tauri", () => ({ tauriFetch: async () => vi.fn() }));
vi.mock("@/components/integrations/use-onboarding-return", () => ({
  useOnboardingReturn: () => false,
}));
vi.mock("@/components/reader/AddToCollectionButton", () => ({
  AddToCollectionButton: () => <button>Add to collection</button>,
}));
vi.mock("@/components/layout/PageHeader", () => ({
  default: ({ title, tools }: { title: string; tools: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {tools}
    </header>
  ),
}));
vi.mock("@/components/layout/PageFrame", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

import InboxView from "./InboxView";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });

let host: HTMLDivElement;
let root: Root | undefined;
const article = (id: string, title: string, sourceName = "Research feed"): InboxItem => ({
  id,
  title,
  sourceName,
  feedUrl: `https://${sourceName === "Research feed" ? "research" : "notes"}.example/feed.xml`,
  url: `https://research.example/${id}`,
  status: "unread",
  summary: `${title} summary`,
  content: "First paragraph.\n\nSecond paragraph.",
  createdAt: "2026-09-30T12:00:00Z",
});

async function renderInbox() {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(createElement(InboxView));
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return host;
}

async function clickButton(label: string) {
  const button = Array.from(host.querySelectorAll("button")).find(
    (item) => item.textContent === label || item.getAttribute("aria-label") === label
  );
  expect(button, label).toBeDefined();
  await act(async () => {
    button?.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

async function enterSearch(value: string) {
  const input = host.querySelector<HTMLInputElement>("[aria-label='Search articles']")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("RSS Inbox task composition", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
    window.history.replaceState(null, "", "/inbox");
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 0)
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    feeds.sync.mockReset().mockImplementation(async (subscriptions) =>
      subscriptions.map((subscription: object) => ({
        status: "fulfilled",
        value: { subscription, addedCount: 0 },
      }))
    );
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    root = undefined;
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("keeps feed management collapsed while checking stale subscriptions", async () => {
    saveSubscriptions({
      subscriptions: [
        {
          title: "Research",
          feedUrl: "https://research.example/feed.xml",
          createdAt: "2026-09-30T12:00:00Z",
        },
      ],
    });
    await renderInbox();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(host.querySelector<HTMLElement>("#subscriptions")?.hidden).toBe(true);
    expect(feeds.sync).toHaveBeenCalledTimes(1);
    await clickButton("Add feed");
    expect(host.querySelector<HTMLElement>("#subscriptions")?.hidden).toBe(false);
    expect(document.activeElement?.id).toBe("subscription-feed-url");
  });

  it("opens setup links and adds a real subscription through the form", async () => {
    window.history.replaceState(null, "", "/inbox#subscriptions");
    await renderInbox();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(host.querySelector<HTMLElement>("#subscriptions")?.hidden).toBe(false);
    const input = host.querySelector<HTMLInputElement>("#subscription-feed-url")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
        input,
        "https://new.example/feed.xml"
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () =>
      input.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );
    expect(loadSubscriptions().subscriptions[0].feedUrl).toBe("https://new.example/feed.xml");
    expect(feeds.sync).toHaveBeenCalledTimes(1);
  });

  it("filters real articles and clears a filter without claiming the inbox is empty", async () => {
    saveInbox({
      items: [
        article("one", "A practical guide"),
        article("two", "Notes on reading", "Notes feed"),
      ],
    });
    await renderInbox();
    await enterSearch("not present");
    expect(host.textContent).toContain("No matching articles");
    expect(host.textContent).not.toContain("Your inbox is empty");
    await clickButton("Clear filters");
    expect(host.querySelectorAll("button[aria-label^='Preview ']")).toHaveLength(2);
    const select = host.querySelector<HTMLSelectElement>("[aria-label='Filter by source']")!;
    await act(async () => {
      select.value = "https://notes.example/feed.xml";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.querySelectorAll("button[aria-label^='Preview ']")).toHaveLength(1);
    expect(host.querySelector("button[aria-label^='Preview ']")?.textContent).toContain(
      "Notes on reading"
    );
  });

  it("opens an article, preserves reading actions, and returns keyboard focus on Escape", async () => {
    saveInbox({ items: [article("one", "A practical guide")] });
    await renderInbox();
    await clickButton("Preview A practical guide");
    expect(loadInbox().items[0].status).toBe("reading");
    const preview = host.querySelector<HTMLElement>("[data-testid='inbox-article-preview']")!;
    expect(preview.textContent).toContain("First paragraph.");
    expect(preview.textContent).toContain("Add to collection");
    expect(preview.querySelector("a[href='https://research.example/one']")).not.toBeNull();
    await act(async () => {
      preview.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(host.querySelector("[data-testid='inbox-article-preview']")).toBeNull();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Preview A practical guide");
  });

  it("keeps roving keyboard navigation for article states", async () => {
    await renderInbox();
    const all = host.querySelector<HTMLButtonElement>("#inbox-tab-all")!;
    await act(async () =>
      all.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }))
    );
    expect(host.querySelector("#inbox-tab-archived")?.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement?.id).toBe("inbox-tab-archived");
    expect(host.textContent).toContain("No archived articles");
  });
});
