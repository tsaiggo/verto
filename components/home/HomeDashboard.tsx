"use client";

import Link from "next/link";
import { FolderOpen, Loader2, TriangleAlert } from "lucide-react";
import ContinueReadingCard from "@/components/home/ContinueReadingCard";
import HomePageHeader from "@/components/home/HomePageHeader";
import {
  AgentHighlightsCard,
  InboxTriageCard,
  RecentCollectionsRow,
  RecentEditsCard,
} from "@/components/home/HomeCards";
import { runtimeHomeWorkspace, type HomeWorkspaceData } from "@/components/home/home-data";
import SurfaceTabs from "@/components/layout/SurfaceTabs";
import {
  useRuntimeLocalIndex,
  type RuntimeLocalIndexState,
} from "@/components/runtime/useRuntimeLocalIndex";

const EMPTY_HOME: HomeWorkspaceData = {
  groups: [],
  recentDocs: [],
  starters: [],
  readableHrefs: [],
};

function RuntimeSourceStatus({ runtime }: { runtime: RuntimeLocalIndexState }) {
  if (runtime.status === "idle") return null;
  if (runtime.status === "loading") {
    return (
      <div className="home-source-status is-loading" role="status">
        <Loader2 aria-hidden className="home-source-status-icon" />
        <span>Opening your local library</span>
        <code>{runtime.folder}</code>
      </div>
    );
  }
  if (runtime.status === "error") {
    return (
      <div className="home-source-status is-error" role="status">
        <TriangleAlert aria-hidden className="home-source-status-icon" />
        <span>Could not open the selected local library.</span>
        <Link href="/integrations">Manage sources</Link>
      </div>
    );
  }

  return (
    <div className="home-source-status is-ready" role="status">
      <FolderOpen aria-hidden className="home-source-status-icon" />
      <span>
        Reading <strong>{runtime.index.documents.length}</strong> real local
        {runtime.index.documents.length === 1 ? " file" : " files"}
      </span>
      <code title={runtime.folder}>{runtime.folder}</code>
      <Link href="/library">Open library</Link>
    </div>
  );
}

interface HomeDashboardProps {
  staticData: HomeWorkspaceData;
  bundledDocumentCount: number;
  bundledSectionCount: number;
}

export default function HomeDashboard({
  staticData,
  bundledDocumentCount,
  bundledSectionCount,
}: HomeDashboardProps) {
  const runtime = useRuntimeLocalIndex();
  const data =
    runtime.status === "ready"
      ? runtimeHomeWorkspace(runtime.index.documents.map((document) => document.node))
      : runtime.status === "idle"
        ? staticData
        : EMPTY_HOME;

  return (
    <>
      <HomePageHeader
        runtime={runtime}
        bundledDocumentCount={bundledDocumentCount}
        bundledSectionCount={bundledSectionCount}
      />

      <SurfaceTabs
        label="Workspace views"
        items={[
          { href: "/", label: "Overview", current: true },
          { href: "/recent", label: "Recent" },
          { href: "/collections", label: "Collections" },
          { href: "/settings", label: "Settings" },
        ]}
      />

      <div className="home-scroll" data-page-scroll>
        <div className="v-page home-grid home-page">
          <RuntimeSourceStatus runtime={runtime} />
          <div className="home-workbench">
            <div className="home-feed" aria-label="Workspace overview">
              <ContinueReadingCard hrefs={data.readableHrefs} starters={data.starters} />
              <RecentEditsCard docs={data.recentDocs} />
              <RecentCollectionsRow groups={data.groups} />
            </div>

            <aside className="home-context" aria-label="Workspace context" data-context-panel>
              <InboxTriageCard />
              <AgentHighlightsCard />
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
