// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import Excalidraw from '@/components/mdx/Excalidraw';

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
});

class MockIntersectionObserver implements IntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  readonly root: Element | Document | null = null;
  readonly rootMargin: string;
  readonly thresholds: ReadonlyArray<number> = [0];
  readonly observed = new Set<Element>();

  constructor(private readonly callback: IntersectionObserverCallback, init?: IntersectionObserverInit) {
    this.rootMargin = init?.rootMargin ?? '0px';
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

  trigger(isIntersecting: boolean) {
    const entries = Array.from(this.observed).map((target) => {
      const rect = target.getBoundingClientRect();
      return {
        boundingClientRect: rect,
        intersectionRatio: isIntersecting ? 1 : 0,
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
const scene = JSON.stringify({ elements: [], appState: {}, files: {} });

function renderExcalidraw() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  act(() => {
    root.render(createElement(Excalidraw, { scene }));
  });
  return { host, root };
}

function cleanup(root: Root, host: HTMLElement) {
  act(() => {
    root.unmount();
  });
  host.remove();
}

describe('Excalidraw', () => {
  afterEach(() => {
    globalThis.IntersectionObserver = originalIntersectionObserver;
    MockIntersectionObserver.instances = [];
    document.body.replaceChildren();
  });

  it('observes the visible wrapper instead of the empty SVG host', async () => {
    globalThis.IntersectionObserver = MockIntersectionObserver;
    const { host, root } = renderExcalidraw();

    const observer = MockIntersectionObserver.instances[0];
    const observed = Array.from(observer.observed);
    expect(observed).toHaveLength(1);
    expect(observed[0].classList.contains('excalidraw')).toBe(true);
    expect(observed[0].classList.contains('excalidraw-host')).toBe(false);

    cleanup(root, host);
  });
});
