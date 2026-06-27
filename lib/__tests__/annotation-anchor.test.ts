import { describe, it, expect } from "vitest";
import { describeRange, locateAnchor } from "@/lib/annotation-anchor";

describe("describeRange", () => {
  it("captures the quote with its surrounding context", () => {
    const text = "The quick brown fox jumps over the lazy dog.";
    const anchor = describeRange(text, 10, 19); // "brown fox"

    expect(anchor.quote).toBe("brown fox");
    expect(anchor.prefix).toBe("The quick ");
    expect(anchor.suffix).toBe(" jumps over the lazy dog.");
    expect(anchor.start).toBe(10);
  });

  it("clamps context at the document edges", () => {
    const text = "Hello world";
    const anchor = describeRange(text, 0, 5); // "Hello"

    expect(anchor.quote).toBe("Hello");
    expect(anchor.prefix).toBe("");
    expect(anchor.suffix).toBe(" world");
  });
});

describe("locateAnchor", () => {
  it("re-locates a unique quote exactly", () => {
    const text = "The quick brown fox jumps over the lazy dog.";
    const anchor = describeRange(text, 10, 19); // "brown fox"

    expect(locateAnchor(text, anchor)).toEqual({ start: 10, end: 19 });
  });

  it("uses surrounding context to pick the right one among duplicate quotes", () => {
    const text = "a red apple, then a green apple, then a blue apple";
    const start = text.indexOf("green apple") + "green ".length; // the 2nd "apple"
    const anchor = describeRange(text, start, start + "apple".length);

    expect(locateAnchor(text, anchor)).toEqual({ start, end: start + "apple".length });
  });

  it("re-locates after surrounding content shifts the offsets (context intact)", () => {
    const original = "intro paragraph. The target phrase is here. outro paragraph.";
    const qStart = original.indexOf("target phrase");
    const anchor = describeRange(original, qStart, qStart + "target phrase".length);

    const shifted = "A NEW LEADING PARAGRAPH WAS ADDED. " + original;
    const want = shifted.indexOf("target phrase");

    expect(locateAnchor(shifted, anchor)).toEqual({
      start: want,
      end: want + "target phrase".length,
    });
  });

  it("returns null when the quote no longer exists", () => {
    const anchor = describeRange("some original text", 5, 13); // "original"

    expect(locateAnchor("completely different content", anchor)).toBeNull();
  });
});
