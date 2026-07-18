// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InboxItem, InboxState } from "@/lib/inbox";
import type { Subscription, SubscriptionsState } from "@/lib/subscriptions";

const mocks = vi.hoisted(() => ({
  deleteSubscriptionAndInboxItems: vi.fn(),
  fetchImpl: vi.fn(),
  inbox: { items: [] } as InboxState,
  isSubscriptionStale: vi.fn(),
  listeners: new Set<() => void>(),
  markSubscriptionSyncFailure: vi.fn(),
  saveSubscription: vi.fn(),
  state: { subscriptions: [] } as SubscriptionsState,
  syncSubscriptions: vi.fn(),
  tauriFetch: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/subscriptions", () => ({
  deleteSubscriptionAndInboxItems: mocks.deleteSubscriptionAndInboxItems,
  isSubscriptionStale: mocks.isSubscriptionStale,
  loadSubscriptions: () => mocks.state,
  markSubscriptionSyncFailure: mocks.markSubscriptionSyncFailure,
  saveSubscription: mocks.saveSubscription,
  subscribeSubscriptions: (listener: () => void) => {
    mocks.listeners.add(listener);
    return () => mocks.listeners.delete(listener);
  },
}));

vi.mock("@/lib/inbox", () => ({
  countInboxItemsByFeed: (items: InboxItem[], feedUrl: string) =>
    items.filter((item) => item.feedUrl === feedUrl).length,
  loadInbox: () => mocks.inbox,
}));

vi.mock("@/lib/feeds/sync", () => ({
  syncSubscriptions: mocks.syncSubscriptions,
}));

vi.mock("@/lib/tauri", () => ({
  tauriFetch: mocks.tauriFetch,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

import SubscriptionManager from "@/components/inbox/SubscriptionManager";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const FEED: Subscription = {
  feedUrl: "https://blog.example.com/feed.xml",
  title: "Example Blog",
  createdAt: "2026-07-17T00:00:00.000Z",
  lastFetchedAt: "2026-07-17T00:00:00.000Z",
};

const ARTICLE: InboxItem = {
  id: "article-1",
  feedUrl: FEED.feedUrl,
  sourceName: FEED.title,
  title: "A saved article",
  url: "https://blog.example.com/article",
  status: "unread",
  createdAt: "2026-07-17T00:00:00.000Z",
};

function notifySubscriptionsChanged() {
  for (const listener of mocks.listeners) listener();
}

function syncSuccess(subscription: Subscription = FEED) {
  return [
    {
      status: "fulfilled" as const,
      value: { subscription, addedCount: 0 },
    },
  ];
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function buttonWithText(host: ParentNode, text: string): HTMLButtonElement | null {
  return (
    Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === text
    ) ?? null
  );
}

async function setInputValue(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

let root: Root | null = null;

async function renderManager(): Promise<HTMLDivElement> {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(createElement(SubscriptionManager)));
  return host;
}

async function openRemoval(host: HTMLElement) {
  const remove = host.querySelector<HTMLButtonElement>('[aria-label="Remove Example Blog"]');
  expect(remove).not.toBeNull();
  await act(async () => remove?.click());
}

function confirmRemoval() {
  return document.querySelector<HTMLButtonElement>(
    '[role="dialog"] [aria-label="Remove Example Blog permanently"]'
  );
}

beforeEach(() => {
  mocks.listeners.clear();
  mocks.state = { subscriptions: [] };
  mocks.inbox = { items: [] };
  mocks.isSubscriptionStale.mockReset().mockReturnValue(false);
  mocks.markSubscriptionSyncFailure.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.tauriFetch.mockReset().mockResolvedValue(mocks.fetchImpl);
  mocks.syncSubscriptions.mockReset().mockResolvedValue(syncSuccess());
  mocks.saveSubscription.mockReset().mockImplementation(async (subscription: Subscription) => {
    mocks.state = {
      subscriptions: [
        subscription,
        ...mocks.state.subscriptions.filter((item) => item.feedUrl !== subscription.feedUrl),
      ],
    };
    notifySubscriptionsChanged();
    return mocks.state;
  });
  mocks.deleteSubscriptionAndInboxItems.mockReset().mockImplementation(async (feedUrl: string) => {
    const removedInboxItems = mocks.inbox.items.filter((item) => item.feedUrl === feedUrl).length;
    mocks.state = {
      subscriptions: mocks.state.subscriptions.filter((item) => item.feedUrl !== feedUrl),
    };
    mocks.inbox = {
      items: mocks.inbox.items.filter((item) => item.feedUrl !== feedUrl),
    };
    notifySubscriptionsChanged();
    return { state: mocks.state, removedInboxItems };
  });
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  document.body.replaceChildren();
});

describe("SubscriptionManager mutation truth", () => {
  it("keeps the URL, disables submission, blocks duplicate adds, and toasts on a true save failure", async () => {
    const pending = deferred<never>();
    mocks.saveSubscription.mockReturnValue(pending.promise);
    const host = await renderManager();
    const input = host.querySelector<HTMLInputElement>("#inbox-feed-url");
    expect(input).not.toBeNull();
    await setInputValue(input!, FEED.feedUrl);
    const add = buttonWithText(host, "Add");

    await act(async () => {
      add?.click();
      add?.click();
      await Promise.resolve();
    });

    expect(mocks.saveSubscription).toHaveBeenCalledTimes(1);
    expect(input?.disabled).toBe(true);
    expect(input?.value).toBe(FEED.feedUrl);
    expect(add?.disabled).toBe(true);
    expect(add?.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      pending.reject(new Error("storage unavailable"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(input?.value).toBe(FEED.feedUrl);
    expect(input?.disabled).toBe(false);
    expect(mocks.syncSubscriptions).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith("Couldn't save this subscription", {
      description: "The feed URL is still here. Check that local storage is available, then retry.",
    });
  });

  it("continues after a mirror-only save rejection when the subscription exists locally", async () => {
    mocks.saveSubscription.mockImplementation(async (subscription: Subscription) => {
      mocks.state = { subscriptions: [subscription] };
      notifySubscriptionsChanged();
      throw new Error("desktop mirror failed");
    });
    mocks.syncSubscriptions.mockImplementation(async (subscriptions: Subscription[]) =>
      syncSuccess(subscriptions[0])
    );
    const host = await renderManager();
    const input = host.querySelector<HTMLInputElement>("#inbox-feed-url");
    await setInputValue(input!, FEED.feedUrl);

    await act(async () => {
      buttonWithText(host, "Add")?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(input?.value).toBe("");
    expect(mocks.syncSubscriptions).toHaveBeenCalledTimes(1);
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Subscribed to blog.example.com",
      expect.objectContaining({ description: "No new articles were found." })
    );
  });

  it("does not claim a save succeeded when the persistence call resolves without local state", async () => {
    mocks.saveSubscription.mockResolvedValue({ subscriptions: [FEED] });
    const host = await renderManager();
    const input = host.querySelector<HTMLInputElement>("#inbox-feed-url");
    await setInputValue(input!, FEED.feedUrl);

    await act(async () => {
      buttonWithText(host, "Add")?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(input?.value).toBe(FEED.feedUrl);
    expect(mocks.syncSubscriptions).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't save this subscription",
      expect.any(Object)
    );
  });

  it("blocks rapid duplicate refresh requests while the first feed check is pending", async () => {
    mocks.state = { subscriptions: [FEED] };
    const pending = deferred<ReturnType<typeof syncSuccess>>();
    mocks.syncSubscriptions.mockReturnValue(pending.promise);
    const host = await renderManager();
    const refresh = host.querySelector<HTMLButtonElement>('[aria-label="Refresh Example Blog"]');

    await act(async () => {
      refresh?.click();
      refresh?.click();
      await Promise.resolve();
    });

    expect(mocks.syncSubscriptions).toHaveBeenCalledTimes(1);
    expect(refresh?.disabled).toBe(true);
    expect(refresh?.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      pending.resolve(syncSuccess());
      await pending.promise;
      await Promise.resolve();
    });

    expect(refresh?.disabled).toBe(false);
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Synced Example Blog",
      expect.objectContaining({ description: "No new articles were found." })
    );
  });

  it("blocks rapid duplicate sync-all requests while the batch is pending", async () => {
    mocks.state = { subscriptions: [FEED] };
    const pending = deferred<ReturnType<typeof syncSuccess>>();
    mocks.syncSubscriptions.mockReturnValue(pending.promise);
    const host = await renderManager();
    const syncAll = buttonWithText(host, "Sync feeds");

    await act(async () => {
      syncAll?.click();
      syncAll?.click();
      await Promise.resolve();
    });

    expect(mocks.syncSubscriptions).toHaveBeenCalledTimes(1);
    expect(syncAll?.disabled).toBe(true);
    expect(syncAll?.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      pending.resolve(syncSuccess());
      await pending.promise;
      await Promise.resolve();
    });

    expect(syncAll?.disabled).toBe(false);
  });

  it("keeps the target and original state, blocks closing and duplicate confirms, and toasts on true removal failure", async () => {
    mocks.state = { subscriptions: [FEED] };
    mocks.inbox = { items: [ARTICLE] };
    const pending = deferred<never>();
    mocks.deleteSubscriptionAndInboxItems.mockReturnValue(pending.promise);
    const host = await renderManager();
    await openRemoval(host);
    const confirm = confirmRemoval();

    await act(async () => {
      confirm?.click();
      confirm?.click();
      await Promise.resolve();
    });

    expect(mocks.deleteSubscriptionAndInboxItems).toHaveBeenCalledTimes(1);
    expect(confirm?.disabled).toBe(true);
    expect(confirm?.getAttribute("aria-busy")).toBe("true");
    expect(confirm?.textContent).toContain("Removing");
    expect(buttonWithText(document, "Cancel")?.disabled).toBe(true);

    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')?.click();
      await Promise.resolve();
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    await act(async () => {
      pending.reject(new Error("storage unavailable"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(host.textContent).toContain(FEED.title);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(confirmRemoval()?.disabled).toBe(false);
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith("Couldn't remove this subscription", {
      description:
        "The subscription or some cached articles are still here. Check local storage and try again.",
    });
  });

  it("closes successfully when deletion applied locally before a mirror rejection", async () => {
    mocks.state = { subscriptions: [FEED] };
    mocks.inbox = { items: [ARTICLE] };
    mocks.deleteSubscriptionAndInboxItems.mockImplementation(async () => {
      mocks.state = { subscriptions: [] };
      mocks.inbox = { items: [] };
      notifySubscriptionsChanged();
      throw new Error("desktop mirror failed");
    });
    const host = await renderManager();
    await openRemoval(host);

    await act(async () => {
      confirmRemoval()?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).not.toContain(FEED.title);
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Removed subscription", {
      description: "Example Blog. Removed 1 cached article.",
    });
  });

  it("does not claim deletion succeeded when the call resolves without removing local state", async () => {
    mocks.state = { subscriptions: [FEED] };
    mocks.inbox = { items: [ARTICLE] };
    mocks.deleteSubscriptionAndInboxItems.mockResolvedValue({
      state: { subscriptions: [] },
      removedInboxItems: 1,
    });
    const host = await renderManager();
    await openRemoval(host);

    await act(async () => {
      confirmRemoval()?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.textContent).toContain(FEED.title);
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't remove this subscription",
      expect.any(Object)
    );
  });
});
