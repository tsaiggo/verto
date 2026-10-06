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

function pendingImage(reader: HTMLElement) {
  const image = document.createElement("img");
  Object.defineProperty(image, "complete", { configurable: true, value: false });
  reader.append(image);
  return image;
}

function restoreFixture() {
  const reader = scrollRegion(0);
  reader.style.setProperty("overflow-anchor", "auto");
  reader.scrollTo = vi.fn((options?: ScrollToOptions | number, y?: number) => {
    reader.scrollTop = typeof options === "number" ? (y ?? 0) : (options?.top ?? 0);
  });
  scrollMocks.getReadingScrollElement.mockReturnValue(reader);
  readingMocks.hydrateReadingState.mockResolvedValue({
    byHref: { "/read/demo": { scrollTop: 480 } },
  });
  document.body.append(reader);
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (frame: number) => frames.delete(frame));
  return {
    reader,
    flushFrame() {
      const batch = [...frames.values()];
      frames.clear();
      batch.forEach((callback) => callback(0));
    },
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
    vi.useRealTimers();
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

  it("keeps the saved offset through late media layout and restores ordinary scroll anchoring", async () => {
    const { reader, flushFrame } = restoreFixture();
    const image = pendingImage(reader);
    const { root } = await renderTracker();
    expect(reader.style.getPropertyValue("overflow-anchor")).toBe("none");
    flushFrame();
    expect(reader.scrollTop).toBe(480);
    reader.scrollTop = 660;
    reader.dispatchEvent(new Event("scroll"));
    expect(readingMocks.saveReadingEntry).not.toHaveBeenCalled();
    image.dispatchEvent(new Event("load"));
    flushFrame();
    flushFrame();
    expect(reader.scrollTop).toBe(480);
    expect(reader.style.getPropertyValue("overflow-anchor")).toBe("auto");
    await act(async () => root.unmount());
    expect(readingMocks.saveReadingEntry.mock.calls.at(-1)?.[0].scrollTop).toBe(480);
  });

  it.each(["wheel", "pointerdown"])(
    "hands scrolling back to the reader when %s interrupts a pending restore",
    async (eventType) => {
      const { reader, flushFrame } = restoreFixture();
      const image = pendingImage(reader);
      const { root } = await renderTracker();
      flushFrame();
      reader.dispatchEvent(new Event(eventType));
      expect(reader.style.getPropertyValue("overflow-anchor")).toBe("auto");
      reader.scrollTop = 700;
      reader.dispatchEvent(new Event("scroll"));
      image.dispatchEvent(new Event("load"));
      flushFrame();
      flushFrame();
      expect(reader.scrollTop).toBe(700);
      await act(async () => root.unmount());
      expect(readingMocks.saveReadingEntry.mock.calls.at(-1)?.[0].scrollTop).toBe(700);
    }
  );

  it("leaves durable progress untouched when unmounted before restore finishes", async () => {
    const { reader, flushFrame } = restoreFixture();
    pendingImage(reader);
    const { root } = await renderTracker();
    await act(async () => root.unmount());
    flushFrame();
    expect(reader.scrollTop).toBe(0);
    expect(reader.style.getPropertyValue("overflow-anchor")).toBe("auto");
    expect(readingMocks.saveReadingEntry).not.toHaveBeenCalled();
  });

  it("ends the temporary protection when a media request never completes", async () => {
    vi.useFakeTimers();
    const { reader, flushFrame } = restoreFixture();
    pendingImage(reader);
    const { root } = await renderTracker();
    flushFrame();
    vi.advanceTimersByTime(2000);
    flushFrame();
    flushFrame();
    expect(reader.scrollTop).toBe(480);
    expect(reader.style.getPropertyValue("overflow-anchor")).toBe("auto");
    await act(async () => root.unmount());
  });
});
