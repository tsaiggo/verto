// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const inboxMock = vi.hoisted(() => ({ state: { items: [] } }));

vi.mock("@/lib/inbox", () => ({
  loadInbox: () => inboxMock.state,
  subscribeInbox: () => () => undefined,
  setInboxStatus: vi.fn(),
  deleteInboxItem: vi.fn(),
}));
vi.mock("@/components/inbox/SubscriptionManager", () => ({ default: () => null }));
vi.mock("@/components/inbox/InboxArticlePreview", () => ({ default: () => null }));
vi.mock("@/components/integrations/use-onboarding-return", () => ({
  useOnboardingReturn: () => false,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import InboxView from "@/components/inbox/InboxView";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

describe("InboxView tab accessibility", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("keeps the empty state in a panel labelled by the selected filter", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(createElement(InboxView)));

    const tabs = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panel = host.querySelector<HTMLElement>('[role="tabpanel"]');
    const allTab = tabs.find((tab) => tab.textContent?.startsWith("All"));
    expect(panel?.textContent).toContain("Your inbox is empty");
    expect(panel?.getAttribute("aria-labelledby")).toBe(allTab?.id);
    expect(tabs.every((tab) => tab.getAttribute("aria-controls") === panel?.id)).toBe(true);

    const unreadTab = tabs.find((tab) => tab.textContent?.startsWith("Unread"));
    await act(async () => unreadTab?.click());
    expect(panel?.getAttribute("aria-labelledby")).toBe(unreadTab?.id);
    expect(panel?.textContent).toContain("No unread items");
    act(() => root.unmount());
  });
});
