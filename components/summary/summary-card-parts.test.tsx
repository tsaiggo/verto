// @vitest-environment jsdom

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface SummaryRecord {
  href: string;
  slug: string[];
  title: string;
  body: string;
  model: string;
  contextNote?: string;
  createdAt: string;
}

const state = vi.hoisted(() => ({
  stored: [] as SummaryRecord[],
  saveSummary: vi.fn(),
  deleteSummary: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/summaries", () => ({
  saveSummary: state.saveSummary,
  deleteSummary: state.deleteSummary,
  loadSummaries: () => ({ summaries: state.stored }),
  findSummary: (summaries: SummaryRecord[], href: string) =>
    summaries.find((summary) => summary.href === href) ?? null,
}));

vi.mock("@/lib/format", () => ({ formatDate: () => "Today" }));
vi.mock("sonner", () => ({ toast: { error: state.toastError } }));

import { SummaryPreview, SummarySaved } from "./summary-card-parts";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const doc = { href: "/read/summary", slug: ["summary"], title: "Summary document" };
const saved: SummaryRecord = {
  ...doc,
  body: "Saved summary",
  model: "test/model",
  contextNote: "Full document",
  createdAt: "2026-07-17T00:00:00.000Z",
};

async function render(element: ReactElement): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, root };
}

function button(host: HTMLElement, label: string): HTMLButtonElement {
  const match = Array.from(host.querySelectorAll<HTMLButtonElement>("button")).find(
    (item) => item.textContent?.trim() === label
  );
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}

function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = () => done();
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("Summary persistence failure semantics", () => {
  beforeEach(() => {
    state.stored = [];
    state.saveSummary.mockReset();
    state.deleteSummary.mockReset();
    state.toastError.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("shows pending save state and ignores duplicate save clicks", async () => {
    const pending = deferred();
    state.saveSummary.mockReturnValue(pending.promise);
    const setPreview = vi.fn();
    const { host, root } = await render(
      createElement(SummaryPreview, {
        preview: { body: "Generated summary", model: "test/model" },
        doc,
        setPreview,
        copy: vi.fn(),
        copied: false,
        contextNote: "Full document",
      })
    );
    const save = button(host, "Save");

    await act(async () => {
      save.click();
      save.click();
      await Promise.resolve();
    });

    expect(state.saveSummary).toHaveBeenCalledTimes(1);
    expect(save.disabled).toBe(true);
    expect(save.getAttribute("aria-busy")).toBe("true");
    expect(save.textContent).toBe("Saving…");

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(setPreview).toHaveBeenCalledWith(null);
    expect(save.disabled).toBe(false);
    act(() => root.unmount());
  });

  it("keeps a preview visible and reports a genuine save failure", async () => {
    state.saveSummary.mockRejectedValue(new Error("quota exceeded"));
    const setPreview = vi.fn();
    const { host, root } = await render(
      createElement(SummaryPreview, {
        preview: { body: "Generated summary", model: "test/model" },
        doc,
        setPreview,
        copy: vi.fn(),
        copied: false,
        contextNote: "Full document",
      })
    );

    await act(async () => {
      button(host, "Save").click();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("Generated summary");
    expect(setPreview).not.toHaveBeenCalled();
    expect(state.toastError).toHaveBeenCalledWith("Couldn't save summary", {
      description:
        "The generated summary is still here. Check that local storage is available, then retry.",
    });

    const retry = button(host, "Save");
    expect(retry.disabled).toBe(false);
    expect(retry.getAttribute("aria-busy")).toBe("false");
    await act(async () => {
      retry.click();
      await Promise.resolve();
    });
    expect(state.saveSummary).toHaveBeenCalledTimes(2);
    act(() => root.unmount());
  });

  it("accepts a local save when only the portable mirror rejects", async () => {
    state.saveSummary.mockImplementation(async (candidate: SummaryRecord) => {
      state.stored = [candidate];
      throw new Error("portable mirror failed");
    });
    const setPreview = vi.fn();
    const { host, root } = await render(
      createElement(SummaryPreview, {
        preview: { body: "Generated summary", model: "test/model" },
        doc,
        setPreview,
        copy: vi.fn(),
        copied: false,
        contextNote: "Full document",
      })
    );

    await act(async () => {
      button(host, "Save").click();
      await Promise.resolve();
    });

    expect(setPreview).toHaveBeenCalledWith(null);
    expect(state.toastError).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it("shows pending delete state and ignores duplicate delete clicks", async () => {
    const pending = deferred();
    state.stored = [saved];
    state.deleteSummary.mockReturnValue(pending.promise);
    const { host, root } = await render(
      createElement(SummarySaved, {
        saved,
        doc,
        regenerate: vi.fn(),
        busy: false,
        token: "token",
        copy: vi.fn(),
        copied: false,
      })
    );
    const remove = button(host, "Delete");

    await act(async () => {
      remove.click();
      remove.click();
      await Promise.resolve();
    });

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(state.deleteSummary).toHaveBeenCalledTimes(1);
    expect(remove.disabled).toBe(true);
    expect(remove.getAttribute("aria-busy")).toBe("true");
    expect(remove.textContent).toContain("Deleting…");

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    expect(remove.disabled).toBe(false);
    act(() => root.unmount());
  });

  it("keeps a saved summary visible and reports a genuine delete failure", async () => {
    state.stored = [saved];
    state.deleteSummary.mockRejectedValue(new Error("quota exceeded"));
    const { host, root } = await render(
      createElement(SummarySaved, {
        saved,
        doc,
        regenerate: vi.fn(),
        busy: false,
        token: "token",
        copy: vi.fn(),
        copied: false,
      })
    );

    await act(async () => {
      button(host, "Delete").click();
      await Promise.resolve();
    });

    expect(host.textContent).toContain("Saved summary");
    expect(state.toastError).toHaveBeenCalledWith("Couldn't delete summary", {
      description: "The summary is still saved. Check that local storage is available, then retry.",
    });

    const retry = button(host, "Delete");
    expect(retry.disabled).toBe(false);
    expect(retry.getAttribute("aria-busy")).toBe("false");
    await act(async () => {
      retry.click();
      await Promise.resolve();
    });
    expect(state.deleteSummary).toHaveBeenCalledTimes(2);
    act(() => root.unmount());
  });

  it("does not duplicate the portable error when the local deletion committed", async () => {
    state.stored = [saved];
    state.deleteSummary.mockImplementation(async () => {
      state.stored = [];
      throw new Error("portable mirror failed");
    });
    const { host, root } = await render(
      createElement(SummarySaved, {
        saved,
        doc,
        regenerate: vi.fn(),
        busy: false,
        token: "token",
        copy: vi.fn(),
        copied: false,
      })
    );

    await act(async () => {
      button(host, "Delete").click();
      await Promise.resolve();
    });

    expect(state.toastError).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});
