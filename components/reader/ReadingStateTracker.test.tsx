// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readingMocks = vi.hoisted(() => ({
  hydrateReadingState: vi.fn(),
  saveReadingEntry: vi.fn(),
}));
const scrollMocks = vi.hoisted(() => ({
  getReadingScrollElement: vi.fn(),
}));

vi.mock("@/lib/reading-state", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/reading-state")>();
  return {
    ...actual,
    hydrateReadingState: readingMocks.hydrateReadingState,
    saveReadingEntry: readingMocks.saveReadingEntry,
  };
});

vi.mock("@/lib/reading-scroll", () => ({
  getReadingScrollElement: scrollMocks.getReadingScrollElement,
  getReadingScrollEventTarget: (element: HTMLElement) => element,
}));

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

describe("ReadingStateTracker", () => {
  beforeEach(() => {
    readingMocks.hydrateReadingState.mockReset().mockResolvedValue({
      version: 2,
      byHref: {},
      recentHrefs: [],
      recent: [],
    });
    readingMocks.saveReadingEntry.mockReset().mockResolvedValue(undefined);
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
});
