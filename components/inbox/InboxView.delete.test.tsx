// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InboxItem, InboxState } from "@/lib/inbox";

const mocks = vi.hoisted(() => ({
  deleteInboxItem: vi.fn(),
  listeners: new Set<() => void>(),
  setInboxStatus: vi.fn(),
  state: { items: [] } as InboxState,
  toastError: vi.fn(),
}));

vi.mock("@/lib/inbox", () => ({
  deleteInboxItem: mocks.deleteInboxItem,
  loadInbox: () => mocks.state,
  setInboxStatus: mocks.setInboxStatus,
  subscribeInbox: (callback: () => void) => {
    mocks.listeners.add(callback);
    return () => mocks.listeners.delete(callback);
  },
}));

vi.mock("@/components/inbox/SubscriptionManager", () => ({ default: () => null }));
vi.mock("@/components/inbox/InboxArticlePreview", () => ({ default: () => null }));
vi.mock("@/components/integrations/use-onboarding-return", () => ({
  useOnboardingReturn: () => false,
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

import InboxView from "@/components/inbox/InboxView";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const ITEM: InboxItem = {
  id: "article-1",
  feedUrl: "https://example.com/feed.xml",
  sourceName: "Example",
  title: "A durable article",
  url: "https://example.com/article",
  status: "archived",
  createdAt: "2026-07-17T00:00:00.000Z",
};

function notifyInboxChanged() {
  for (const listener of mocks.listeners) listener();
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

function buttonWithText(text: string) {
  return (
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === text
    ) ?? null
  );
}

let root: Root | null = null;

async function renderArchivedInbox() {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(createElement(InboxView)));

  const archivedTab = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
    (tab) => tab.textContent?.startsWith("Archived")
  );
  await act(async () => archivedTab?.click());
  return host;
}

async function requestDeletion(host: HTMLElement) {
  const action = host.querySelector<HTMLButtonElement>(
    '[aria-label="Delete A durable article permanently"]'
  );
  expect(action).not.toBeNull();
  await act(async () => action?.click());
  return action!;
}

beforeEach(() => {
  mocks.deleteInboxItem.mockReset();
  mocks.listeners.clear();
  mocks.setInboxStatus.mockReset();
  mocks.state = { items: [ITEM] };
  mocks.toastError.mockReset();
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
    root = null;
  }
  document.body.replaceChildren();
});

describe("InboxView permanent deletion", () => {
  it("names the article in both delete controls and requires explicit confirmation", async () => {
    const host = await renderArchivedInbox();
    const action = await requestDeletion(host);

    expect(action.getAttribute("aria-label")).toContain(ITEM.title);
    expect(document.body.textContent).toContain(
      'This permanently removes "A durable article" from Inbox on this device.'
    );
    expect(document.body.textContent).toContain("This cannot be undone.");
    const confirm = document.querySelector<HTMLButtonElement>(
      '[role="dialog"] [aria-label="Delete A durable article permanently"]'
    );
    expect(confirm).not.toBeNull();
    expect(mocks.deleteInboxItem).not.toHaveBeenCalled();

    await act(async () => buttonWithText("Cancel")?.click());

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(mocks.deleteInboxItem).not.toHaveBeenCalled();
    expect(host.textContent).toContain(ITEM.title);
  });

  it("keeps the row and confirmation, blocks re-entry, and toasts on true failure", async () => {
    const pending = deferred<never>();
    mocks.deleteInboxItem.mockReturnValue(pending.promise);
    const host = await renderArchivedInbox();
    await requestDeletion(host);

    const confirm = document.querySelector<HTMLButtonElement>(
      '[role="dialog"] [aria-label="Delete A durable article permanently"]'
    );
    await act(async () => {
      confirm?.click();
      await Promise.resolve();
    });

    expect(confirm?.disabled).toBe(true);
    expect(confirm?.textContent).toContain("Deleting...");
    expect(buttonWithText("Cancel")?.disabled).toBe(true);
    confirm?.click();
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')?.click();
      await Promise.resolve();
    });
    expect(mocks.deleteInboxItem).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    await act(async () => {
      pending.reject(new Error("storage unavailable"));
      await Promise.resolve();
    });

    expect(host.textContent).toContain(ITEM.title);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(
      document.querySelector<HTMLButtonElement>(
        '[role="dialog"] [aria-label="Delete A durable article permanently"]'
      )?.disabled
    ).toBe(false);
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Couldn't delete A durable article",
      expect.objectContaining({ description: expect.stringContaining("still in Inbox") })
    );
  });

  it("closes without a duplicate toast when a rejected delete is already applied locally", async () => {
    mocks.deleteInboxItem.mockImplementation(async () => {
      mocks.state = { items: [] };
      notifyInboxChanged();
      throw new Error("desktop mirror failed");
    });
    const host = await renderArchivedInbox();
    await requestDeletion(host);

    await act(async () => {
      document
        .querySelector<HTMLButtonElement>(
          '[role="dialog"] [aria-label="Delete A durable article permanently"]'
        )
        ?.click();
      await Promise.resolve();
    });

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(host.textContent).toContain("No archived items");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
  it("keeps the row and reports a true status persistence failure", async () => {
    mocks.setInboxStatus.mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    const host = await renderArchivedInbox();

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[aria-label="Restore to inbox"]')?.click();
    });

    expect(host.textContent).toContain(ITEM.title);
    expect(mocks.toastError).toHaveBeenCalledWith("Couldn't update this article", {
      description: "Check that local storage is available, then retry.",
    });
  });

  it("does not report a duplicate status error when the local change already applied", async () => {
    mocks.setInboxStatus.mockImplementation((id: string, status: InboxItem["status"]) => {
      mocks.state = {
        items: mocks.state.items.map((item) => (item.id === id ? { ...item, status } : item)),
      };
      notifyInboxChanged();
      throw new Error("desktop mirror failed");
    });
    const host = await renderArchivedInbox();

    await act(async () => {
      host.querySelector<HTMLButtonElement>('[aria-label="Restore to inbox"]')?.click();
    });

    expect(host.textContent).toContain("No archived items");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
