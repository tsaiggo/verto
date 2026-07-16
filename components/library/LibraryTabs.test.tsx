// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import LibraryTabs, { libraryTabId, type LibraryTabId } from "./LibraryTabs";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const tabs: { id: LibraryTabId; label: string }[] = [
  { id: "all", label: "All Documents" },
  { id: "notes", label: "Notes" },
];
const counts: Record<LibraryTabId, number> = {
  all: 2,
  notes: 1,
  drafts: 0,
  images: 0,
  archives: 0,
};

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it("associates each library tab with the shared document panel", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  const onValueChange = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      createElement(LibraryTabs, {
        tabs,
        value: "all",
        counts,
        onValueChange,
      })
    );
  });

  const all = host.querySelector<HTMLButtonElement>(`#${libraryTabId("all")}`);
  const notes = host.querySelector<HTMLButtonElement>(`#${libraryTabId("notes")}`);
  expect(all?.getAttribute("aria-controls")).toBe("library-documents");
  expect(all?.getAttribute("aria-selected")).toBe("true");
  expect(notes?.tabIndex).toBe(-1);

  act(() => notes?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })));
  expect(onValueChange).toHaveBeenCalledWith("all");

  act(() => root.unmount());
});
