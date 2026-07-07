import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHAT_WIDTH_DEFAULT,
  CHAT_WIDTH_MAX,
  CHAT_WIDTH_MIN,
  clampChatWidth,
  loadChatWidth,
  saveChatWidth,
} from "@/lib/ui/panel-width";

const WIDE = 1920; // a viewport big enough that the fraction guard never bites

describe("clampChatWidth", () => {
  it("keeps a comfortable width unchanged", () => {
    expect(clampChatWidth(420, WIDE)).toBe(420);
  });

  it("floors below the minimum", () => {
    expect(clampChatWidth(120, WIDE)).toBe(CHAT_WIDTH_MIN);
  });

  it("ceils above the maximum", () => {
    expect(clampChatWidth(5000, WIDE)).toBe(CHAT_WIDTH_MAX);
  });

  it("never exceeds 92% of a small viewport", () => {
    // 92% of 500 = 460, but MAX(640) is higher, so the viewport guard wins.
    expect(clampChatWidth(640, 500)).toBe(460);
  });

  it("keeps the panel on-screen when the viewport is narrower than MIN", () => {
    // 92% of 300 = 276; the guard beats MIN so the panel never overflows.
    expect(clampChatWidth(360, 300)).toBe(276);
  });

  it("falls back to the default for non-finite input", () => {
    expect(clampChatWidth(Number.NaN, WIDE)).toBe(CHAT_WIDTH_DEFAULT);
  });

  it("rounds fractional widths", () => {
    expect(clampChatWidth(421.6, WIDE)).toBe(422);
  });
});

describe("loadChatWidth / saveChatWidth", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the default when nothing is stored", () => {
    expect(loadChatWidth(WIDE)).toBe(CHAT_WIDTH_DEFAULT);
  });

  it("round-trips a saved width", () => {
    saveChatWidth(500);
    expect(loadChatWidth(WIDE)).toBe(500);
  });

  it("clamps a stored value that is too large", () => {
    saveChatWidth(CHAT_WIDTH_MAX + 200);
    expect(loadChatWidth(WIDE)).toBe(CHAT_WIDTH_MAX);
  });

  it("falls back to the default for a malformed stored value", () => {
    window.localStorage.setItem("verto:chat-width", "not-a-number");
    expect(loadChatWidth(WIDE)).toBe(CHAT_WIDTH_DEFAULT);
  });

  it("re-clamps the stored width against the current viewport", () => {
    saveChatWidth(600);
    // On a 500px viewport the guard caps at 460 even though 600 was persisted.
    expect(loadChatWidth(500)).toBe(460);
  });
});
