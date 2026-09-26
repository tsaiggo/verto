"use client";

import type { LabsSidebarTree } from "@/lib/sidebar/buildLabsTree";
import LibraryPanel from "./LibraryPanel";
import HomePanel from "./HomePanel";
import InboxPanel from "./InboxPanel";
import CollectionsPanel from "./CollectionsPanel";
import TagsPanel from "./TagsPanel";
import BookmarksPanel from "./BookmarksPanel";
import RecentPanel from "./RecentPanel";
import SearchPanel from "./SearchPanel";
import AgentPanel from "./AgentPanel";
import StudioPanel from "./StudioPanel";
import IntegrationsPanel from "./IntegrationsPanel";
import SettingsPanel from "./SettingsPanel";
import HelpPanel from "./HelpPanel";
import EditorPanel from "./EditorPanel";
import TrashPanel from "./TrashPanel";
import OnboardingPanel from "./OnboardingPanel";

export type PanelResolver = (
  pathname: string,
  tree: LabsSidebarTree,
  onCollapse?: () => void,
  helpTree?: LabsSidebarTree
) => React.ReactNode;

const LIBRARY_PREFIXES = ["/library", "/read"] as const;

function isLibraryRoute(pathname: string): boolean {
  return LIBRARY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// eslint-disable-next-line complexity -- maps many path prefixes to per-route panels
export function getPanel(
  pathname: string,
  tree: LabsSidebarTree,
  onCollapse?: () => void,
  helpTree?: LabsSidebarTree
): React.ReactNode {
  if (isLibraryRoute(pathname)) {
    return <LibraryPanel tree={tree} onCollapse={onCollapse} />;
  }
  if (pathname === "/") return <HomePanel tree={tree} onCollapse={onCollapse} />;
  if (pathname.startsWith("/inbox")) return <InboxPanel onCollapse={onCollapse} />;
  if (pathname.startsWith("/collections")) return <CollectionsPanel onCollapse={onCollapse} />;
  if (pathname.startsWith("/tags")) return <TagsPanel tree={tree} onCollapse={onCollapse} />;
  if (pathname.startsWith("/bookmarks")) return <BookmarksPanel onCollapse={onCollapse} />;
  if (pathname.startsWith("/recent")) return <RecentPanel tree={tree} onCollapse={onCollapse} />;
  if (pathname.startsWith("/search")) return <SearchPanel onCollapse={onCollapse} />;
  if (pathname.startsWith("/agent")) return <AgentPanel onCollapse={onCollapse} />;
  if (pathname.startsWith("/studio")) return <StudioPanel onCollapse={onCollapse} />;
  if (pathname.startsWith("/integrations") || pathname.startsWith("/sources"))
    return <IntegrationsPanel onCollapse={onCollapse} />;
  if (pathname.startsWith("/settings")) return <SettingsPanel onCollapse={onCollapse} />;
  if (pathname.startsWith("/help"))
    return <HelpPanel tree={helpTree ?? []} onCollapse={onCollapse} />;
  if (pathname.startsWith("/editor")) return <EditorPanel onCollapse={onCollapse} />;
  if (pathname.startsWith("/trash")) return <TrashPanel onCollapse={onCollapse} />;
  if (pathname.startsWith("/onboarding")) return <OnboardingPanel onCollapse={onCollapse} />;
  return <HomePanel tree={tree} onCollapse={onCollapse} />;
}

export { isLibraryRoute };
