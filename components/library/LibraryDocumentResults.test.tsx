// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import LibraryDocumentResults from "@/components/library/LibraryDocumentResults";
import type { LibraryDoc } from "@/components/library/LibraryBrowser";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const document: LibraryDoc = {
  title: "Grounded notes",
  ext: ".mdx",
  href: "/read/grounded-notes",
  section: "Research",
  tags: ["ai"],
  updatedLabel: "Yesterday",
  updatedISO: "2026-07-25T00:00:00.000Z",
  kind: "doc",
};

let currentRoot: Root | null = null;

function renderResults(
  overrides: Partial<React.ComponentProps<typeof LibraryDocumentResults>> = {}
): HTMLDivElement {
  const host = window.document.createElement("div");
  window.document.body.append(host);
  currentRoot = createRoot(host);
  act(() => {
    currentRoot?.render(
      createElement(LibraryDocumentResults, {
        rows: [],
        progressMap: new Map<string, number>(),
        bookmarkedHrefs: new Set<string>(),
        emptyMessage: "No documents in this library.",
        state: "idle",
        hasActiveFilters: false,
        onClearFilters: vi.fn(),
        activeView: "all",
        libraryDocumentCount: 0,
        ...overrides,
      })
    );
  });
  return host;
}

afterEach(() => {
  act(() => currentRoot?.unmount());
  currentRoot = null;
  window.document.body.replaceChildren();
});

describe("LibraryDocumentResults states", () => {
  it("announces the loading document skeleton without exposing fake rows", () => {
    const host = renderResults({ state: "loading" });

    expect(host.querySelector("[role='status']")?.getAttribute("aria-label")).toBe(
      "Loading documents"
    );
    expect(host.querySelector("[role='list']")).toBeNull();
  });

  it("lets readers clear a filter that has no matches", () => {
    const onClearFilters = vi.fn();
    const host = renderResults({ hasActiveFilters: true, onClearFilters });
    const clear = Array.from(host.querySelectorAll("button")).find(
      (button) => button.textContent === "Clear filters"
    );

    expect(host.textContent).toContain("No matching documents");
    act(() => clear?.click());
    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it("describes an empty view without claiming the whole library is empty", () => {
    const host = renderResults({
      activeView: "notes",
      libraryDocumentCount: 4,
    });

    expect(host.textContent).toContain("No notes yet");
    expect(host.textContent).toContain("Markdown notes in this library will appear here.");
    expect(host.textContent).not.toContain("Connect a folder");
  });

  it("offers source management when a connected folder has no Markdown files", () => {
    const host = renderResults({
      state: "ready",
      activeView: "all",
      libraryDocumentCount: 0,
      emptyMessage: "No .md or .mdx files found in this folder.",
    });
    const manage = host.querySelector<HTMLAnchorElement>("a[href='/integrations#local-files']");

    expect(host.textContent).toContain("No Markdown files found");
    expect(manage?.textContent).toContain("Manage source");
    expect(host.textContent).not.toContain("Connect a folder");
  });

  it("prioritizes a recoverable source error over stale URL filters", () => {
    const host = renderResults({
      state: "error",
      hasActiveFilters: true,
      emptyMessage: "Could not load this local library.",
    });
    const alert = host.querySelector("[role='alert']");
    const recovery = host.querySelector<HTMLAnchorElement>("a[href='/integrations#local-files']");

    expect(alert?.textContent).toContain("This folder couldn’t be read");
    expect(alert?.textContent).not.toContain("No matching documents");
    expect(recovery?.textContent).toContain("Choose another folder");
  });

  it("keeps each document a native reader link with a separate bookmark control", () => {
    const host = renderResults({ rows: [document] });
    const link = host.querySelector<HTMLAnchorElement>("a[href='/read/grounded-notes']");
    const bookmark = host.querySelector<HTMLButtonElement>(
      "button[aria-label='Bookmark: Grounded notes']"
    );

    expect(host.querySelector("[role='list']")?.getAttribute("aria-label")).toBe("Documents");
    expect(link?.textContent).toContain("Grounded notes");
    expect(link?.textContent).toContain("Source: Research");
    expect(link?.textContent).toContain("Updated: Yesterday");
    expect(bookmark?.getAttribute("aria-pressed")).toBe("false");
  });
});
