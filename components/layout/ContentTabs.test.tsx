// @vitest-environment jsdom

import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContentTabs from "@/components/layout/ContentTabs";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

const ITEMS = [
  { id: "all", label: "All", count: 4, panelId: "documents-panel" },
  { id: "notes", label: "Notes", count: 2, panelId: "documents-panel" },
  { id: "archived", label: "Archived", count: 1, panelId: "documents-panel" },
] as const;

function Harness() {
  const [value, setValue] = useState<(typeof ITEMS)[number]["id"]>("all");
  return (
    <ContentTabs
      items={[...ITEMS]}
      value={value}
      onValueChange={setValue}
      label="Document filters"
    />
  );
}

describe("ContentTabs", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it("uses one selected tab and supports roving arrow-key focus", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => root.render(createElement(Harness)));
    const tabs = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs).toHaveLength(3);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(tabs[1]?.tabIndex).toBe(-1);
    const tabIds = tabs.map((tab) => tab.id);
    expect(new Set(tabIds).size).toBe(3);
    expect(tabIds.every(Boolean)).toBe(true);
    expect(tabs.every((tab) => tab.getAttribute("aria-controls") === "documents-panel")).toBe(true);

    act(() =>
      tabs[0]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    );

    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs.map((tab) => tab.id)).toEqual(tabIds);
    act(() => root.unmount());
  });
});
