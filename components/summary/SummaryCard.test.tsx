// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  toastError: vi.fn(),
  saved: {
    href: "/read/summary",
    slug: ["summary"],
    title: "Summary document",
    body: "Saved summary",
    model: "test/model",
    createdAt: "2026-07-17T00:00:00.000Z",
  },
}));

vi.mock("@/lib/ai", () => ({
  AssistantError: class AssistantError extends Error {},
  createAssistantProvider: vi.fn(),
  getAssistantConfig: () => ({ enabled: true, kind: "mock", model: "test/model" }),
}));
vi.mock("@/lib/ai/context", () => ({
  buildSummaryMessages: vi.fn(),
  describeDocContextScope: () => "Full document",
  readDocContextFromDom: () => ({}),
}));
vi.mock("@/lib/ai/key-store", () => ({ loadWebKey: () => null }));
vi.mock("@/lib/local-folder", () => ({
  LOCAL_FOLDER_CHANGED_EVENT: "verto:local-folder-changed",
}));
vi.mock("@/lib/tauri", () => ({ tauriFetch: vi.fn() }));
vi.mock("@/lib/format", () => ({ formatDate: () => "Today" }));
vi.mock("@/lib/summaries", () => ({
  deleteSummary: vi.fn(),
  saveSummary: vi.fn(),
  loadSummaries: () => ({ summaries: [state.saved] }),
  findSummary: (summaries: Array<typeof state.saved>, href: string) =>
    summaries.find((summary) => summary.href === href) ?? null,
}));
vi.mock("sonner", () => ({ toast: { error: state.toastError } }));

import SummaryCard from "./SummaryCard";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

describe("SummaryCard clipboard failures", () => {
  beforeEach(() => {
    state.toastError.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("reports a copy failure without claiming success", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        createElement(SummaryCard, {
          doc: { href: "/read/summary", slug: ["summary"], title: "Summary document" },
        })
      );
      await Promise.resolve();
    });

    const copy = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "Copy"
    );
    await act(async () => {
      copy?.click();
      await Promise.resolve();
    });

    expect(copy?.textContent?.trim()).toBe("Copy");
    expect(state.toastError).toHaveBeenCalledWith("Couldn't copy summary", {
      description: "Clipboard access is unavailable. Check your browser permissions and retry.",
    });
    act(() => root.unmount());
  });
});
