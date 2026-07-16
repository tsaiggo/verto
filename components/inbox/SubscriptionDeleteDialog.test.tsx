// @vitest-environment jsdom

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import SubscriptionDeleteDialog, {
  type SubscriptionRemovalTarget,
} from "@/components/inbox/SubscriptionDeleteDialog";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const target: SubscriptionRemovalTarget = {
  subscription: {
    feedUrl: "https://blog.example.com/feed.xml",
    title: "Example Blog",
    createdAt: "2026-06-05T00:00:00.000Z",
  },
  cachedArticleCount: 3,
};

async function render(element: ReactElement): Promise<Root> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return root;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("SubscriptionDeleteDialog", () => {
  it("states the permanent feed and cached article impact before confirming", async () => {
    const root = await render(
      createElement(SubscriptionDeleteDialog, {
        target,
        onCancel: vi.fn(),
        onConfirm: vi.fn(),
      })
    );

    expect(document.body.textContent).toContain(
      "This permanently removes “Example Blog” and its 3 cached articles from this device."
    );
    expect(document.body.textContent).toContain("This cannot be undone.");

    act(() => root.unmount());
  });

  it("cancels without calling the destructive handler and only confirms explicitly", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const root = await render(
      createElement(SubscriptionDeleteDialog, { target, onCancel, onConfirm })
    );

    await act(async () => {
      Array.from(document.querySelectorAll("button"))
        .find((button) => button.textContent === "Cancel")
        ?.click();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    await act(async () => {
      Array.from(document.querySelectorAll("button"))
        .find((button) => button.textContent === "Remove permanently")
        ?.click();
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
  });
});
