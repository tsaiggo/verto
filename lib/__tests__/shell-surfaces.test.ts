import { describe, expect, it } from "vitest";
import { isDocumentRoute, isFullBoardRoute, resolveShellSurface } from "@/lib/shell-surfaces";

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

  it("maps full-board product specification pages to the board shell", () => {
    expect(resolveShellSurface("/settings")).toMatchObject({
      mode: "full-board",
      documentRoute: false,
      showPrimaryRail: false,
      showMobileNav: false,
      showTopBar: false,
      showDocumentTabs: false,
      primaryNavVariant: "hidden",
      shellClassName: "app-shell--agent",
    });
    expect(resolveShellSurface("/agent/history")).toMatchObject({
      mode: "full-board",
      documentRoute: false,
      showPrimaryRail: false,
      showMobileNav: false,
      showTopBar: false,
      showDocumentTabs: false,
      primaryNavVariant: "hidden",
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

  it("recognizes all full-board prefixes", () => {
    expect(isFullBoardRoute("/library")).toBe(true);
    expect(isFullBoardRoute("/integrations/setup")).toBe(true);
    expect(isFullBoardRoute("/studio")).toBe(false);
  });
});
