// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { replaceCurrentRoute } from "@/lib/browser-navigation";

describe("replaceCurrentRoute", () => {
  it("replaces query state on the current route without adding history", () => {
    window.history.replaceState(null, "", "/library?tag=missing");
    const length = window.history.length;

    replaceCurrentRoute("/library");

    expect(window.location.pathname).toBe("/library");
    expect(window.location.search).toBe("");
    expect(window.history.length).toBe(length);
  });

  it("keeps a same-origin query and hash", () => {
    replaceCurrentRoute("/library?source=local#results");

    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      "/library?source=local#results"
    );
  });

  it("rejects a cross-origin target", () => {
    expect(() => replaceCurrentRoute("https://example.com/library")).toThrow(
      "replaceCurrentRoute only accepts same-origin URLs."
    );
  });
});
