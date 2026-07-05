export type ShellSurfaceMode = "home" | "reader" | "reader-root" | "full-board" | "compact";

export interface ShellSurface {
  mode: ShellSurfaceMode;
  documentRoute: boolean;
  showPrimaryRail: boolean;
  showMobileNav: boolean;
  showTopBar: boolean;
  showDocumentTabs: boolean;
  primaryNavVariant: "home" | "reader" | "compact" | "hidden";
  shellClassName: string;
}

const DOCUMENT_ROUTE_PREFIXES = ["/read", "/help", "/runtime"] as const;
const FULL_BOARD_ROUTE_PREFIXES = ["/agent", "/library", "/integrations", "/settings"] as const;

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isDocumentRoute(pathname: string): boolean {
  return DOCUMENT_ROUTE_PREFIXES.some((route) => matchesRoute(pathname, route));
}

export function isFullBoardRoute(pathname: string): boolean {
  return FULL_BOARD_ROUTE_PREFIXES.some((route) => matchesRoute(pathname, route));
}

export function resolveShellSurface(pathname: string): ShellSurface {
  if (pathname === "/") {
    return {
      mode: "home",
      documentRoute: false,
      showPrimaryRail: true,
      showMobileNav: true,
      showTopBar: false,
      showDocumentTabs: false,
      primaryNavVariant: "home",
      shellClassName: "app-shell--home",
    };
  }

  if (matchesRoute(pathname, "/read")) {
    const readerRoot = pathname === "/read";
    return {
      mode: readerRoot ? "reader-root" : "reader",
      documentRoute: true,
      showPrimaryRail: !readerRoot,
      showMobileNav: !readerRoot,
      showTopBar: true,
      showDocumentTabs: !readerRoot,
      primaryNavVariant: "reader",
      shellClassName: readerRoot ? "app-shell--reader app-shell--reader-root" : "app-shell--reader",
    };
  }

  if (isDocumentRoute(pathname)) {
    return {
      mode: "compact",
      documentRoute: true,
      showPrimaryRail: true,
      showMobileNav: true,
      showTopBar: true,
      showDocumentTabs: true,
      primaryNavVariant: "compact",
      shellClassName: "app-shell--compact",
    };
  }

  if (isFullBoardRoute(pathname)) {
    return {
      mode: "full-board",
      documentRoute: false,
      showPrimaryRail: false,
      showMobileNav: false,
      showTopBar: false,
      showDocumentTabs: false,
      primaryNavVariant: "hidden",
      shellClassName: "app-shell--agent",
    };
  }

  return {
    mode: "compact",
    documentRoute: false,
    showPrimaryRail: true,
    showMobileNav: true,
    showTopBar: false,
    showDocumentTabs: false,
    primaryNavVariant: "compact",
    shellClassName: "app-shell--compact",
  };
}
