import { describe, expect, it } from "vitest";
import { readerRouteHasDocumentTabs } from "@/lib/reader-route-frame";

describe("readerRouteHasDocumentTabs", () => {
  it.each([
    ["/read", false],
    ["/read/", false],
    ["/read/demo", true],
    ["/read/guides/setup", true],
    ["/read/tags/demo", false],
    ["/read/status/draft", false],
    ["/library", false],
  ])("maps %s to %s", (pathname, expected) => {
    expect(readerRouteHasDocumentTabs(pathname)).toBe(expected);
  });
});
