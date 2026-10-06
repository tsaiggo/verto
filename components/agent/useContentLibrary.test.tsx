// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ContentDocument } from "@/lib/agent-content/types";

const repository = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/agent-content/browser", () => ({ createBrowserRepository: repository.create }));
vi.mock("@/lib/browser-articles", () => ({ subscribeBrowserArticles: () => () => {} }));
import { useContentLibrary } from "./useContentLibrary";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });

const sources: never[] = [];
function Harness({ href }: { href: string }) {
  const content = useContentLibrary(sources, true, href);
  return createElement(
    "div",
    { "data-service": Boolean(content.service), "data-status": content.status },
    content.sources.map((item) => item.title).join(",")
  );
}

function pendingRepository() {
  let resolve!: (documents: ContentDocument[]) => void;
  const pending = new Promise<ContentDocument[]>((done) => {
    resolve = done;
  });
  return {
    value: {
      listDocuments: () => pending,
      readDocument: async () => null,
      listAnnotations: async () => [],
    },
    resolve,
  };
}

function contentDocument(href: string): ContentDocument {
  return {
    id: `source:${href}`,
    href,
    title: href,
    version: "v1",
    format: "md",
    draft: false,
    tags: [],
    sourceLabel: "Library",
  };
}

let root: Root;
let host: HTMLDivElement;

describe("content Library conversation ownership", () => {
  beforeEach(() => {
    repository.create.mockReset();
  });
  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    host?.remove();
  });

  it("removes the previous document service immediately while the new scope loads", async () => {
    const first = pendingRepository();
    const second = pendingRepository();
    repository.create.mockReturnValueOnce(first.value).mockReturnValueOnce(second.value);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root.render(createElement(Harness, { href: "/read/a" }));
    });
    await act(async () => {
      first.resolve([contentDocument("/read/a")]);
      await vi.waitFor(() => expect(repository.create).toHaveBeenCalledTimes(1));
    });
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(host.textContent).toBe("/read/a");
    });
    expect(host.firstElementChild?.getAttribute("data-service")).toBe("true");
    expect(host.textContent).toBe("/read/a");
    await act(async () => {
      root.render(createElement(Harness, { href: "/read/b" }));
    });
    expect(host.firstElementChild?.getAttribute("data-status")).toBe("loading");
    expect(host.firstElementChild?.getAttribute("data-service")).toBe("false");
    expect(host.textContent).not.toContain("/read/a");
    await act(async () => {
      second.resolve([contentDocument("/read/b")]);
      await vi.waitFor(() => expect(repository.create).toHaveBeenCalledTimes(2));
    });
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(host.textContent).toBe("/read/b");
    });
    expect(host.textContent).toBe("/read/b");
    expect(repository.create.mock.calls.map((call) => call[1].currentHref)).toEqual([
      "/read/a",
      "/read/b",
    ]);
  });
});
