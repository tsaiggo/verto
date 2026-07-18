// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReadingEntry } from "@/lib/reading-state";

const readingMocks = vi.hoisted(() => ({
  hydrateReadingState: vi.fn(),
  loadReadingState: vi.fn(),
  saveReadingEntry: vi.fn(),
}));
const toastMocks = vi.hoisted(() => ({ error: vi.fn() }));
const scrollMocks = vi.hoisted(() => ({
  getReadingScrollElement: vi.fn(),
}));

vi.mock("@/lib/reading-state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/reading-state")>();
  return {
    ...actual,
    hydrateReadingState: readingMocks.hydrateReadingState,
    loadReadingState: readingMocks.loadReadingState,
    saveReadingEntry: readingMocks.saveReadingEntry,
  };
});

vi.mock("@/lib/reading-scroll", () => ({
  getReadingScrollElement: scrollMocks.getReadingScrollElement,
  getReadingScrollEventTarget: (element: HTMLElement) => element,
}));

vi.mock("sonner", () => ({ toast: { error: toastMocks.error } }));

import ReadingStateTracker from "./ReadingStateTracker";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

function scrollRegion(scrollTop: number) {
  const element = document.createElement("div");
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: 1000 },
    scrollHeight: { configurable: true, value: 2000 },
    scrollTop: { configurable: true, writable: true, value: scrollTop },
  });
  return element;
}

function readingState(entry?: ReadingEntry) {
  return {
    version: 2 as const,
    byHref: entry ? { [entry.href]: entry } : {},
    recentHrefs: entry ? [entry.href] : [],
    recent: entry ? [entry] : [],
  };
}

async function renderTracker(): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(ReadingStateTracker, {
        href: "/read/demo",
        slug: ["demo"],
        title: "Demo",
        path: "demo.md",
      })
    );
  });
  await vi.waitFor(() => expect(scrollMocks.getReadingScrollElement).toHaveBeenCalled());
  return { host, root };
}

async function firePageHide() {
  await act(async () => {
    window.dispatchEvent(new Event("pagehide"));
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ReadingStateTracker", () => {
  beforeEach(() => {
    readingMocks.hydrateReadingState.mockReset().mockResolvedValue({
      version: 2,
      byHref: {},
      recentHrefs: [],
      recent: [],
    });
    readingMocks.loadReadingState.mockReset().mockReturnValue(readingState());
    readingMocks.saveReadingEntry.mockReset().mockResolvedValue(undefined);
    toastMocks.error.mockReset();
    scrollMocks.getReadingScrollElement.mockReset();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("flushes progress from the reader instead of the destination route on unmount", async () => {
    const reader = scrollRegion(0);
    const destination = scrollRegion(0);
    document.body.append(reader, destination);
    scrollMocks.getReadingScrollElement.mockReturnValue(reader);
    const { root } = await renderTracker();

    reader.scrollTop = 500;
    reader.dispatchEvent(new Event("scroll"));

    // During a Next.js route transition, the destination scroll region may be
    // queryable before passive effect cleanup runs.
    scrollMocks.getReadingScrollElement.mockReturnValue(destination);
    await act(async () => root.unmount());

    const finalEntry = readingMocks.saveReadingEntry.mock.calls.at(-1)?.[0];
    expect(finalEntry).toMatchObject({
      href: "/read/demo",
      progress: 50,
      scrollTop: 500,
    });
    expect(scrollMocks.getReadingScrollElement).toHaveBeenCalledTimes(1);
  });

  it("reports repeated genuine save failures only once", async () => {
    const reader = scrollRegion(250);
    document.body.append(reader);
    scrollMocks.getReadingScrollElement.mockReturnValue(reader);
    readingMocks.saveReadingEntry.mockRejectedValue(new Error("quota exceeded"));
    const { root } = await renderTracker();

    await firePageHide();
    await firePageHide();
    await firePageHide();

    expect(toastMocks.error).toHaveBeenCalledTimes(1);
    expect(toastMocks.error).toHaveBeenCalledWith("Couldn't save reading progress", {
      id: "reading-progress-save-error",
      description:
        "Check that local storage is available. Verto will retry as you continue reading.",
    });

    readingMocks.saveReadingEntry.mockResolvedValue(undefined);
    await act(async () => root.unmount());
  });

  it("does not duplicate the portable error when the attempted entry exists locally", async () => {
    let localEntry: ReadingEntry | undefined;
    const reader = scrollRegion(250);
    document.body.append(reader);
    scrollMocks.getReadingScrollElement.mockReturnValue(reader);
    readingMocks.loadReadingState.mockImplementation(() => readingState(localEntry));
    readingMocks.saveReadingEntry.mockImplementation(async (entry: ReadingEntry) => {
      localEntry = entry;
      throw new Error("portable mirror failed");
    });
    const { root } = await renderTracker();

    await firePageHide();
    await firePageHide();

    expect(toastMocks.error).not.toHaveBeenCalled();

    readingMocks.saveReadingEntry.mockResolvedValue(undefined);
    await act(async () => root.unmount());
  });

  it("accepts a newer local entry when an older mirror attempt rejects", async () => {
    let localEntry: ReadingEntry | undefined;
    const reader = scrollRegion(250);
    document.body.append(reader);
    scrollMocks.getReadingScrollElement.mockReturnValue(reader);
    readingMocks.loadReadingState.mockImplementation(() => readingState(localEntry));
    readingMocks.saveReadingEntry.mockImplementation(async (entry: ReadingEntry) => {
      localEntry = {
        ...entry,
        lastReadAt: new Date(Date.parse(entry.lastReadAt) + 1_000).toISOString(),
        scrollTop: entry.scrollTop + 10,
      };
      throw new Error("older portable mirror failed");
    });
    const { root } = await renderTracker();

    await firePageHide();

    expect(toastMocks.error).not.toHaveBeenCalled();

    readingMocks.saveReadingEntry.mockResolvedValue(undefined);
    await act(async () => root.unmount());
  });

  it("resets the failure latch after a later save succeeds", async () => {
    const reader = scrollRegion(250);
    document.body.append(reader);
    scrollMocks.getReadingScrollElement.mockReturnValue(reader);
    readingMocks.saveReadingEntry.mockRejectedValue(new Error("quota exceeded"));
    const { root } = await renderTracker();

    await firePageHide();
    expect(toastMocks.error).toHaveBeenCalledTimes(1);

    readingMocks.saveReadingEntry.mockResolvedValue(undefined);
    await firePageHide();

    readingMocks.saveReadingEntry.mockRejectedValue(new Error("quota exceeded again"));
    await firePageHide();
    expect(toastMocks.error).toHaveBeenCalledTimes(2);

    readingMocks.saveReadingEntry.mockResolvedValue(undefined);
    await act(async () => root.unmount());
  });
});
