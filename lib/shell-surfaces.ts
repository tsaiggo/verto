export type ShellSurfaceMode = "home" | "reader" | "reader-root" | "compact";

export interface ShellSurface {
  mode: ShellSurfaceMode;
  documentRoute: boolean;
  showPrimaryRail: boolean;
  showTopBar: boolean;
  showDocumentTabs: boolean;
  primaryNavVariant: "home" | "reader" | "compact" | "hidden";
  shellClassName: string;
}

const DOCUMENT_ROUTE_PREFIXES = ["/read", "/help", "/runtime"] as const;

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isDocumentRoute(pathname: string): boolean {
  return DOCUMENT_ROUTE_PREFIXES.some((route) => matchesRoute(pathname, route));
}

export function resolveShellSurface(pathname: string): ShellSurface {
  if (pathname === "/") {
    return {
      mode: "home",
      documentRoute: false,
      showPrimaryRail: true,
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
      showTopBar: true,
      showDocumentTabs: true,
      primaryNavVariant: "compact",
      shellClassName: "app-shell--compact",
    };
  }

  return {
    mode: "compact",
    documentRoute: false,
    showPrimaryRail: true,
    showTopBar: false,
    showDocumentTabs: false,
    primaryNavVariant: "compact",
    shellClassName: "app-shell--compact",
  };
}
