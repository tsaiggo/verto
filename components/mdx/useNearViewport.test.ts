// @vitest-environment jsdom

import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNearViewport } from "@/components/mdx/useNearViewport";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly root: Element | Document | null = null;
  readonly rootMargin: string;
  readonly thresholds: ReadonlyArray<number> = [0];
  readonly observed = new Set<Element>();

  constructor(
    private readonly callback: IntersectionObserverCallback,
    init?: IntersectionObserverInit
  ) {
    this.rootMargin = init?.rootMargin ?? "0px";
    MockIntersectionObserver.instances.push(this);
  }

  observe = (target: Element) => {
    this.observed.add(target);
  };

  unobserve = (target: Element) => {
    this.observed.delete(target);
  };

  disconnect = () => {
    this.observed.clear();
  };

  takeRecords = () => [];

  trigger(isIntersecting: boolean, intersectionRatio = isIntersecting ? 1 : 0) {
    const entries = Array.from(this.observed).map((target) => {
      const rect = target.getBoundingClientRect();
      return {
        boundingClientRect: rect,
        intersectionRatio,
        intersectionRect: rect,
        isIntersecting,
        rootBounds: null,
        target,
        time: performance.now(),
      } satisfies IntersectionObserverEntry;
    });
    this.callback(entries, this);
  }
}

const originalIntersectionObserver = globalThis.IntersectionObserver;

function Probe({ onChange }: { onChange: (value: boolean) => void }) {
  const [ref, isNearViewport] = useNearViewport<HTMLDivElement>();
  onChange(isNearViewport);
  return createElement("div", { ref });
}

function renderProbe(onChange: (value: boolean) => void) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(Probe, { onChange }));
  });
  return { host, root };
}

function cleanup(root: Root, host: HTMLElement) {
  act(() => {
    root.unmount();
  });
  host.remove();
}

describe("useNearViewport", () => {
  afterEach(() => {
    globalThis.IntersectionObserver = originalIntersectionObserver;
    MockIntersectionObserver.instances = [];
    document.body.replaceChildren();
  });

  it("stays inactive until the observed element nears the viewport", () => {
    globalThis.IntersectionObserver = MockIntersectionObserver;
    const changes: boolean[] = [];
    const { host, root } = renderProbe((value) => changes.push(value));

    expect(changes.at(-1)).toBe(false);
    expect(MockIntersectionObserver.instances).toHaveLength(1);
    expect(MockIntersectionObserver.instances[0].rootMargin).toBe("640px 0px");

    act(() => {
      MockIntersectionObserver.instances[0].trigger(true);
    });

    expect(changes.at(-1)).toBe(true);
    expect(MockIntersectionObserver.instances[0].observed.size).toBe(0);

    cleanup(root, host);
  });

  it("treats positive intersection ratio as near the viewport", () => {
    globalThis.IntersectionObserver = MockIntersectionObserver;
    const changes: boolean[] = [];
    const { host, root } = renderProbe((value) => changes.push(value));

    act(() => {
      MockIntersectionObserver.instances[0].trigger(false, 0.5);
    });

    expect(changes.at(-1)).toBe(true);

    cleanup(root, host);
  });

  it("keeps offscreen work idle when the observer never intersects", () => {
    vi.useFakeTimers();
    globalThis.IntersectionObserver = MockIntersectionObserver;
    const changes: boolean[] = [];
    const { host, root } = renderProbe((value) => changes.push(value));

    expect(changes.at(-1)).toBe(false);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(changes.at(-1)).toBe(false);

    cleanup(root, host);
    vi.useRealTimers();
  });

  it("loads immediately when IntersectionObserver is unavailable", () => {
    vi.useFakeTimers();
    Reflect.deleteProperty(globalThis, "IntersectionObserver");
    const changes: boolean[] = [];
    const { host, root } = renderProbe((value) => changes.push(value));

    expect(changes.at(-1)).toBe(false);
    act(() => {
      vi.runAllTimers();
    });

    expect(changes.at(-1)).toBe(true);

    cleanup(root, host);
    vi.useRealTimers();
  });
});
