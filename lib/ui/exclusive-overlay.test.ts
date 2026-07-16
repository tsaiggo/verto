// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

describe("exclusive overlay coordination", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  it("replays the active overlay to a late subscriber", async () => {
    const { onExclusiveOverlayChange, requestExclusiveOverlay } =
      await import("@/lib/ui/exclusive-overlay");
    requestExclusiveOverlay("mobile-navigation");

    const listener = vi.fn();
    const unsubscribe = onExclusiveOverlayChange(listener);

    expect(listener).toHaveBeenCalledWith("mobile-navigation", true);
    unsubscribe();
  });

  it("does not clear a newer overlay when an older one releases", async () => {
    const { onExclusiveOverlayChange, releaseExclusiveOverlay, requestExclusiveOverlay } =
      await import("@/lib/ui/exclusive-overlay");
    requestExclusiveOverlay("mobile-navigation");
    releaseExclusiveOverlay("reading-companion");

    const listener = vi.fn();
    const unsubscribe = onExclusiveOverlayChange(listener);

    expect(listener).toHaveBeenCalledWith("mobile-navigation", true);
    unsubscribe();
  });
});
