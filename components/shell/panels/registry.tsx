"use client";

import type { LabsSidebarTree } from "@/lib/sidebar/buildLabsTree";
import GenericPanel from "./GenericPanel";
import LibraryPanel from "./LibraryPanel";

/**
 * Stable registry interface: getPanel(pathname): ReactNode
 * Phase 2 will fill per-route panels. For now:
 * - /library + /read* -> LibraryPanel (ContentNode adapter)
 * - every other route -> GenericPanel (temporary)
 * Match semantics mirror VxRail's isActive grouping for /library+/read.
 */

export type PanelResolver = (pathname: string, tree: LabsSidebarTree, onCollapse?: () => void) => React.ReactNode;

const LIBRARY_PREFIXES = ["/library", "/read"] as const;

function isLibraryRoute(pathname: string): boolean {
  return LIBRARY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// eslint-disable-next-line complexity -- maps many path prefixes to human labels
function labelFor(pathname: string): string {
  if (pathname === "/") return "Home";
  if (isLibraryRoute(pathname)) return "Library";
  if (pathname.startsWith("/recent")) return "Recent";
  if (pathname.startsWith("/inbox")) return "Inbox";
  if (pathname.startsWith("/collections")) return "Collections";
  if (pathname.startsWith("/tags")) return "Tags";
  if (pathname.startsWith("/bookmarks")) return "Bookmarks";
  if (pathname.startsWith("/agent")) return "Agent";
  if (pathname.startsWith("/studio")) return "Studio";
  if (pathname.startsWith("/search")) return "Search";
  if (pathname.startsWith("/editor")) return "Editor";
  if (pathname.startsWith("/integrations") || pathname.startsWith("/sources")) return "Sources";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/help")) return "Help";
  if (pathname.startsWith("/runtime")) return "Local runtime";
  return "Workspace";
}

// Keep exported function stable for phase 2
export function getPanel(pathname: string, tree: LabsSidebarTree, onCollapse?: () => void): React.ReactNode {
  if (isLibraryRoute(pathname)) {
    return <LibraryPanel tree={tree} onCollapse={onCollapse} />;
  }
  // TODO(ws-shell-2): per-route panel — GenericPanel temporary
  return <GenericPanel routeLabel={labelFor(pathname)} onCollapse={onCollapse} />;
}

export { isLibraryRoute, labelFor };
