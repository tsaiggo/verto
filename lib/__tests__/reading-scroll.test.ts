import { afterEach, describe, expect, it, vi } from "vitest";

import { getReadingScrollElement, getReadingScrollEventTarget } from "@/lib/reading-scroll";

interface DocumentStubOptions {
  pageScroller?: HTMLElement | null;
  mainContent?: HTMLElement | null;
}

function stubDocument({ pageScroller = null, mainContent = null }: DocumentStubOptions = {}) {
  const documentElement = {} as HTMLElement;
  vi.stubGlobal("document", {
    querySelector: vi.fn(() => pageScroller),
    getElementById: vi.fn(() => mainContent),
    documentElement,
  });
  return documentElement;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getReadingScrollElement", () => {
  it("prefers the dedicated page scroller used by reader routes", () => {
    const pageScroller = {} as HTMLElement;
    const mainContent = {} as HTMLElement;
    stubDocument({ pageScroller, mainContent });

    expect(getReadingScrollElement()).toBe(pageScroller);
  });

  it("falls back to main content for compact document routes", () => {
    const mainContent = {} as HTMLElement;
    stubDocument({ mainContent });

    expect(getReadingScrollElement()).toBe(mainContent);
  });

  it("falls back to the document element for legacy layouts", () => {
    const documentElement = stubDocument();

    expect(getReadingScrollElement()).toBe(documentElement);
  });
});

describe("getReadingScrollEventTarget", () => {
  it("listens on window only when the document element scrolls", () => {
    const documentElement = stubDocument();
    const windowTarget = {} as Window;
    vi.stubGlobal("window", windowTarget);

    expect(getReadingScrollEventTarget(documentElement)).toBe(windowTarget);
  });

  it("listens directly on an inner scroll region", () => {
    const scroller = {} as HTMLElement;
    stubDocument({ pageScroller: scroller });
    vi.stubGlobal("window", {} as Window);

    expect(getReadingScrollEventTarget(scroller)).toBe(scroller);
  });
});
