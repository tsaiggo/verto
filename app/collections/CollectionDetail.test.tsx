// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  collections: [
    {
      id: "reading-list",
      name: "Reading list",
      docHrefs: ["/read/persisted"],
      docTitles: { "/read/persisted": "Persisted document" },
      createdAt: "2026-07-17T00:00:00.000Z",
    },
  ],
  removeDocFromCollection: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/collections", () => ({
  loadCollections: () => state.collections,
  removeDocFromCollection: state.removeDocFromCollection,
}));

vi.mock("sonner", () => ({ toast: { error: state.toastError } }));

import { CollectionDetail } from "./CollectionDetail";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

describe("CollectionDetail removal failures", () => {
  beforeEach(() => {
    state.removeDocFromCollection.mockReset().mockRejectedValue(new Error("quota exceeded"));
    state.toastError.mockReset();
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("keeps the document visible and explains that it was not removed", async () => {
    const collection = state.collections[0]!;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        createElement(CollectionDetail, {
          collectionId: collection.id,
          collection,
          documentTitles: new Map(),
        })
      )
    );

    const remove = host.querySelector<HTMLButtonElement>(
      '[aria-label="Remove Persisted document"]'
    );
    await act(async () => {
      remove?.click();
      await Promise.resolve();
    });

    expect(state.removeDocFromCollection).toHaveBeenCalledWith("reading-list", "/read/persisted");
    expect(host.textContent).toContain("Persisted document");
    expect(state.toastError).toHaveBeenCalledWith("Couldn't remove document", {
      description:
        "“Persisted document” is still in Reading list. Check that local storage is available, then retry.",
    });

    act(() => root.unmount());
  });
});
