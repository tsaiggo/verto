import { describe, expect, it } from "vitest";
import {
  collectionItemOrigin,
  formatCollectionDate,
} from "@/components/collections/collection-view-model";

describe("collectionItemOrigin", () => {
  it("keeps local reader paths internal", () => {
    expect(collectionItemOrigin("/read/guides/start")).toEqual({
      isExternal: false,
      label: "Library document",
      path: "/read/guides/start",
    });
  });

  it("presents safe web URLs without a decorative separator", () => {
    expect(collectionItemOrigin("https://www.example.com/research?q=reader#notes")).toEqual({
      isExternal: true,
      label: "Web article",
      path: "example.com/research?q=reader#notes",
    });
  });

  it("does not treat non-web protocols as external articles", () => {
    expect(collectionItemOrigin("javascript:alert(1)")).toEqual({
      isExternal: false,
      label: "Library document",
      path: "javascript:alert(1)",
    });
  });
});

describe("formatCollectionDate", () => {
  it("formats stable UTC dates", () => {
    expect(formatCollectionDate("2026-07-01T23:30:00.000Z")).toBe("1 Jul 2026");
  });

  it("does not invent a date for malformed values", () => {
    expect(formatCollectionDate("not-a-date")).toBe("Date unavailable");
  });
});
