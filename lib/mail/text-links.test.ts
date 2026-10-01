import { describe, expect, it } from "vitest";
import { mailTextParts, safeMailLink } from "./text-links";

describe("plain email links", () => {
  it("preserves all text and line breaks while excluding surrounding punctuation from links", () => {
    const text =
      "Read (https://example.com/a_(b)).\nContact mailto:help@example.com?subject=Hello， thanks.";
    const parts = mailTextParts(text);
    expect(parts.map((part) => part.text).join("")).toBe(text);
    expect(parts.filter((part) => part.href).map((part) => part.href)).toEqual([
      "https://example.com/a_(b)",
      "mailto:help@example.com?subject=Hello",
    ]);
  });

  it("keeps markup and unsafe or incomplete protocols as plain text", () => {
    const text =
      "<script>alert(1)</script> javascript:https://evil.example data:text/html,test https:// https://user:pass@example.com/";
    const parts = mailTextParts(text);
    expect(parts).toEqual([{ text }]);
    expect(safeMailLink("javascript:alert(1)")).toBeUndefined();
    expect(safeMailLink("https://example.com/\nattack")).toBeUndefined();
    expect(safeMailLink("mailto:not-an-address")).toBeUndefined();
    expect(safeMailLink(undefined)).toBeUndefined();
  });

  it("handles several links, Chinese punctuation, uppercase schemes and an empty body", () => {
    const text = "HTTPS://example.com/docs。\nhttp://example.com/path, mailto:me@example.com";
    const parts = mailTextParts(text);
    expect(parts.map((part) => part.text).join("")).toBe(text);
    expect(parts.filter((part) => part.href).map((part) => part.href)).toEqual([
      "HTTPS://example.com/docs",
      "http://example.com/path",
      "mailto:me@example.com",
    ]);
    expect(mailTextParts("")).toEqual([]);
  });
});
