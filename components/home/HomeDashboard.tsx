"use client";

import Link from "next/link";
import { FolderOpen, Loader2, TriangleAlert } from "lucide-react";
import ContinueReadingCard from "@/components/home/ContinueReadingCard";
import {
  AgentHighlightsCard,
  InboxTriageCard,
  RecentCollectionsRow,
  RecentEditsCard,
} from "@/components/home/HomeCards";
import { runtimeHomeWorkspace, type HomeWorkspaceData } from "@/components/home/home-data";
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

export default function HomeDashboard({ staticData }: { staticData: HomeWorkspaceData }) {
  const runtime = useRuntimeLocalIndex();
  const data =
    runtime.status === "ready"
      ? runtimeHomeWorkspace(runtime.index.documents.map((document) => document.node))
      : runtime.status === "idle"
        ? staticData
        : EMPTY_HOME;

  return (
    <div className="v-page home-grid home-page">
      <RuntimeSourceStatus runtime={runtime} />
      <div className="home-row home-row-3">
        <ContinueReadingCard hrefs={data.readableHrefs} starters={data.starters} />
        <RecentEditsCard docs={data.recentDocs} />
        <AgentHighlightsCard />
      </div>

      <div className="home-row home-row-inbox">
        <InboxTriageCard />
      </div>

      <RecentCollectionsRow groups={data.groups} />
    </div>
  );
}
