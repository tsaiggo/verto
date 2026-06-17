import { describe, it, expect } from "vitest";
import { externalUrlToOpen } from "@/components/desktop/ExternalLinkHandler";

const APP = "tauri://localhost/read/intro";

describe("externalUrlToOpen", () => {
  it("opens absolute external http(s) links", () => {
    expect(externalUrlToOpen("https://github.com/tsaiggo/verto", APP)).toBe(
      "https://github.com/tsaiggo/verto"
    );
    expect(externalUrlToOpen("http://example.com/", APP)).toBe("http://example.com/");
  });

  it("opens mailto and tel links", () => {
    expect(externalUrlToOpen("mailto:hi@example.com", APP)).toBe("mailto:hi@example.com");
    expect(externalUrlToOpen("tel:+15551234567", APP)).toBe("tel:+15551234567");
  });

  it("leaves same-origin app routes to in-webview navigation", () => {
    expect(externalUrlToOpen("/read/other", APP)).toBeNull();
    expect(externalUrlToOpen("tauri://localhost/help", APP)).toBeNull();
  });

  it("ignores in-page anchors and empty hrefs", () => {
    expect(externalUrlToOpen("#section", APP)).toBeNull();
    expect(externalUrlToOpen("", APP)).toBeNull();
    expect(externalUrlToOpen(null, APP)).toBeNull();
  });

  it("ignores unparseable and unsupported-scheme hrefs", () => {
    expect(externalUrlToOpen("ht!tp://%%%", APP)).toBeNull();
    expect(externalUrlToOpen("javascript:alert(1)", APP)).toBeNull();
  });
});
