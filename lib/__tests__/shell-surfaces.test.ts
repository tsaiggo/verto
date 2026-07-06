import { describe, expect, it } from "vitest";
import { isDocumentRoute, resolveShellSurface } from "@/lib/shell-surfaces";

describe("resolveShellSurface", () => {
  it("keeps the dashboard home route on the home shell", () => {
    expect(resolveShellSurface("/")).toMatchObject({
      mode: "home",
      documentRoute: false,
      showPrimaryRail: true,
      showMobileNav: true,
      showTopBar: false,
      showDocumentTabs: false,
      primaryNavVariant: "home",
      shellClassName: "app-shell--home",
    });
  });

  it("treats nested reader pages as document routes with the primary rail", () => {
    expect(resolveShellSurface("/read/annotation-system")).toMatchObject({
      mode: "reader",
      documentRoute: true,
      showPrimaryRail: true,
      showMobileNav: true,
      showTopBar: true,
      showDocumentTabs: true,
      primaryNavVariant: "reader",
      shellClassName: "app-shell--reader",
    });
  });

  it("treats the reader root as a dedicated board-style shell without the primary rail", () => {
    expect(resolveShellSurface("/read")).toMatchObject({
      mode: "reader-root",
      documentRoute: true,
      showPrimaryRail: false,
      showMobileNav: false,
      showTopBar: true,
      showDocumentTabs: false,
      primaryNavVariant: "reader",
      shellClassName: "app-shell--reader app-shell--reader-root",
    });
  });

  it("routes product surfaces to the redesign shell (non-document, own chrome)", () => {
    expect(resolveShellSurface("/settings")).toMatchObject({
      mode: "compact",
      documentRoute: false,
      showTopBar: false,
      showDocumentTabs: false,
      shellClassName: "app-shell--compact",
    });
    expect(resolveShellSurface("/agent/history")).toMatchObject({
      mode: "compact",
      documentRoute: false,
      showDocumentTabs: false,
    });
    expect(resolveShellSurface("/library")).toMatchObject({
      mode: "compact",
      documentRoute: false,
    });
  });

  it("keeps non-document utility routes on the compact rail without reader chrome", () => {
    expect(resolveShellSurface("/search")).toMatchObject({
      mode: "compact",
      documentRoute: false,
      showPrimaryRail: true,
      showMobileNav: true,
      showTopBar: false,
      showDocumentTabs: false,
      primaryNavVariant: "compact",
      shellClassName: "app-shell--compact",
    });
  });
});

describe("route helpers", () => {
  it("recognizes all document-route prefixes", () => {
    expect(isDocumentRoute("/help/getting-started")).toBe(true);
    expect(isDocumentRoute("/runtime/github")).toBe(true);
    expect(isDocumentRoute("/library")).toBe(false);
  });
});
