// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TableOfContents from "@/components/layout/TableOfContents";

const items = [
  { id: "overview", text: "Overview", level: 2 },
  { id: "details", text: "Details", level: 3 },
];

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

let frameCallbacks: FrameRequestCallback[] = [];

function rect(top: number, height = 24): DOMRect {
  return {
    bottom: top + height,
    height,
    left: 0,
    right: 800,
    top,
    width: 800,
    x: 0,
    y: top,
    toJSON: () => ({}),
  };
}

function articleFixture() {
  let overviewTop = 24;
  let detailsTop = 420;
  const scrollRoot = document.createElement("div");
  scrollRoot.dataset.pageScroll = "";
  Object.defineProperties(scrollRoot, {
    clientHeight: { configurable: true, value: 600 },
    scrollHeight: { configurable: true, value: 1200 },
    scrollTop: { configurable: true, writable: true, value: 0 },
  });
  scrollRoot.getBoundingClientRect = () => rect(0, 600);

  const overview = document.createElement("h2");
  overview.id = "overview";
  overview.getBoundingClientRect = () => rect(overviewTop);
  const details = document.createElement("h3");
  details.id = "details";
  details.getBoundingClientRect = () => rect(detailsTop);
  const host = document.createElement("div");
  scrollRoot.append(overview, details, host);
  document.body.append(scrollRoot);

  return {
    host,
    scrollRoot,
    moveHeadings: (nextOverviewTop: number, nextDetailsTop: number) => {
      overviewTop = nextOverviewTop;
      detailsTop = nextDetailsTop;
    },
  };
}

async function flushAnimationFrames() {
  await act(async () => {
    const callbacks = frameCallbacks.splice(0);
    callbacks.forEach((callback) => callback(0));
  });
}

async function mountTable(host: HTMLElement): Promise<Root> {
  const root = createRoot(host);
  await act(async () => {
    root.render(createElement(TableOfContents, { items, title: "A useful document" }));
  });
  return root;
}

describe("TableOfContents", () => {
  beforeEach(() => {
    frameCallbacks = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("renders a titled article outline with a deterministic initial location", () => {
    const html = renderToStaticMarkup(
      createElement(TableOfContents, {
        items,
        title: "A useful document",
      })
    );

    expect(html).toContain('aria-label="Table of contents"');
    expect(html).toContain("A useful document");
    expect(html).toContain("1 of 2");
    expect(html).toContain('href="#overview"');
    expect(html).toContain('aria-current="location"');
    expect(html).toContain("depth-3");
  });

  it("omits the outline when an article has no headings", () => {
    const html = renderToStaticMarkup(createElement(TableOfContents, { items: [] }));
    expect(html).toBe("");
  });

  it("tracks the article scroll root and keeps the active heading visible", async () => {
    const { host, moveHeadings, scrollRoot } = articleFixture();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    const root = await mountTable(host);
    await flushAnimationFrames();
    expect(host.querySelector('[href="#overview"]')?.getAttribute("aria-current")).toBe("location");

    moveHeadings(-240, 48);
    scrollRoot.scrollTop = 400;
    scrollRoot.dispatchEvent(new Event("scroll"));
    await flushAnimationFrames();

    expect(host.querySelector('[href="#details"]')?.getAttribute("aria-current")).toBe("location");
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest" });
    await act(async () => root.unmount());
  });

  it("applies a deep link after hydration without changing the server markup", async () => {
    window.history.replaceState(null, "", "/read/demo#details");
    const { host } = articleFixture();
    host.innerHTML = renderToString(
      createElement(TableOfContents, { items, title: "A useful document" })
    );
    expect(host.querySelector('[href="#overview"]')?.getAttribute("aria-current")).toBe("location");

    let root: Root | undefined;
    await act(async () => {
      root = hydrateRoot(
        host,
        createElement(TableOfContents, { items, title: "A useful document" })
      );
    });
    await flushAnimationFrames();

    expect(host.querySelector('[href="#details"]')?.getAttribute("aria-current")).toBe("location");
    await act(async () => root?.unmount());
  });
});
