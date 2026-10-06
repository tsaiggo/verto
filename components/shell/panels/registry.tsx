"use client";

import { Suspense } from "react";
import type { LabsSidebarTree } from "@/lib/sidebar/buildLabsTree";
import LibraryPanel from "./LibraryPanel";
import CollectionsPanel from "./CollectionsPanel";
import TagsPanel from "./TagsPanel";
import BookmarksPanel from "./BookmarksPanel";
import RecentPanel from "./RecentPanel";
import SearchPanel from "./SearchPanel";
import AgentPanel from "./AgentPanel";
import IntegrationsPanel from "./IntegrationsPanel";
import SettingsPanel from "./SettingsPanel";
import HelpPanel from "./HelpPanel";
import TrashPanel from "./TrashPanel";
import OnboardingPanel from "./OnboardingPanel";
import MailPanel from "./MailPanel";

export type PanelResolver = (
  pathname: string,
  tree: LabsSidebarTree,
  onCollapse?: () => void,
  helpTree?: LabsSidebarTree
) => React.ReactNode;

function isLibraryRoute(pathname: string): boolean {
  return pathname === "/library" || pathname.startsWith("/library/");
}

// eslint-disable-next-line complexity -- maps many path prefixes to per-route panels
export function getPanel(
  pathname: string,
  tree: LabsSidebarTree,
  onCollapse?: () => void,
  helpTree?: LabsSidebarTree
): React.ReactNode {
  // Document navigation and Home, Inbox, and Insights controls live in their main surfaces.
  if (
    pathname === "/" ||
    ["/read", "/editor", "/inbox", "/studio"].some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    )
  )
    return null;
  if (isLibraryRoute(pathname)) {
    return <LibraryPanel tree={tree} onCollapse={onCollapse} />;
  }
  if (pathname.startsWith("/mail"))
    return (
      <Suspense fallback={null}>
        <MailPanel onCollapse={onCollapse} />
      </Suspense>
    );
  if (pathname.startsWith("/collections")) return <CollectionsPanel onCollapse={onCollapse} />;
  if (pathname.startsWith("/tags")) return <TagsPanel tree={tree} onCollapse={onCollapse} />;
  if (pathname.startsWith("/bookmarks")) return <BookmarksPanel onCollapse={onCollapse} />;
  if (pathname.startsWith("/recent")) return <RecentPanel tree={tree} onCollapse={onCollapse} />;
  if (pathname.startsWith("/search")) return <SearchPanel onCollapse={onCollapse} />;
  if (pathname.startsWith("/agent")) return <AgentPanel onCollapse={onCollapse} />;
  if (pathname.startsWith("/integrations") || pathname.startsWith("/sources"))
    return <IntegrationsPanel onCollapse={onCollapse} />;
  if (pathname.startsWith("/settings")) return <SettingsPanel onCollapse={onCollapse} />;
  if (pathname.startsWith("/help"))
    return <HelpPanel tree={helpTree ?? []} onCollapse={onCollapse} />;
  if (pathname.startsWith("/trash")) return <TrashPanel onCollapse={onCollapse} />;
  if (pathname.startsWith("/onboarding")) return <OnboardingPanel onCollapse={onCollapse} />;
  return null;
}

export { isLibraryRoute };
