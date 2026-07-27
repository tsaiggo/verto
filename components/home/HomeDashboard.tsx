"use client";

import Link from "next/link";
import { ArrowRight, FolderOpen, Loader2, TriangleAlert } from "lucide-react";
import ContinueReadingCard from "@/components/home/ContinueReadingCard";
import HomePageHeader from "@/components/home/HomePageHeader";
import {
  AgentAskCard,
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

function RuntimeSourceStatus({
  runtime,
  staticSourceError,
}: {
  runtime: RuntimeLocalIndexState;
  staticSourceError: boolean;
}) {
  if (runtime.status === "idle") {
    if (!staticSourceError) return null;
    return (
      <div className="home-source-status is-error" role="alert">
        <TriangleAlert aria-hidden className="home-source-status-icon" />
        <span>The configured content source could not be opened.</span>
        <Link href="/integrations#local-files">Manage sources</Link>
      </div>
    );
  }
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
      <div className="home-source-status is-error" role="alert">
        <TriangleAlert aria-hidden className="home-source-status-icon" />
        <span>
          <strong>Could not open the selected local library.</strong> Check its permission or choose
          it again.
        </span>
        <Link href="/integrations#local-files">Manage sources</Link>
      </div>
    );
  }

  return null;
}

function HomeLoadingState() {
  return (
    <div className="home-workbench home-loading-workbench" aria-hidden>
      <div className="home-loading-panel home-loading-primary">
        <span className="home-loading-line is-heading" />
        <span className="home-loading-line is-wide" />
        <span className="home-loading-line is-medium" />
      </div>
      <div className="home-loading-panel home-loading-context">
        <span className="home-loading-line is-heading" />
        <span className="home-loading-line is-wide" />
        <span className="home-loading-line is-medium" />
      </div>
      <div className="home-loading-secondary">
        <span className="home-loading-line is-heading" />
        <span className="home-loading-line is-wide" />
        <span className="home-loading-line is-wide" />
      </div>
    </div>
  );
}

function HomeEmptyState() {
  return (
    <section className="home-empty" aria-labelledby="home-empty-title">
      <span className="home-empty-icon" aria-hidden>
        <FolderOpen />
      </span>
      <div className="home-empty-copy">
        <h2 id="home-empty-title">Open your reading workspace</h2>
        <p>
          Choose a local folder of Markdown or MDX files. Verto keeps those files as the source of
          truth.
        </p>
      </div>
      <Link href="/integrations#local-files" className="v-btn home-empty-action">
        Choose local folder
        <ArrowRight aria-hidden />
      </Link>
    </section>
  );
}

interface HomeDashboardProps {
  staticData: HomeWorkspaceData;
  bundledDocumentCount: number;
  bundledSectionCount: number;
  staticSourceError?: boolean;
}

export default function HomeDashboard({
  staticData,
  bundledDocumentCount,
  bundledSectionCount,
  staticSourceError = false,
}: HomeDashboardProps) {
  const runtime = useRuntimeLocalIndex();
  const data =
    runtime.status === "ready"
      ? runtimeHomeWorkspace(runtime.index.documents.map((document) => document.node))
      : runtime.status === "idle"
        ? staticData
        : EMPTY_HOME;
  const sourceFailed =
    runtime.status === "error" || (runtime.status === "idle" && staticSourceError);
  const sourceLoading = runtime.status === "loading";
  const hasWorkspaceContent =
    data.readableHrefs.length > 0 ||
    data.recentDocs.length > 0 ||
    data.starters.length > 0 ||
    data.groups.length > 0;

  return (
    <div className="home-scroll" data-page-scroll>
      <div className="home-frame">
        <HomePageHeader
          runtime={runtime}
          bundledDocumentCount={bundledDocumentCount}
          bundledSectionCount={bundledSectionCount}
        />
        <div className="v-page home-grid home-page">
          <RuntimeSourceStatus runtime={runtime} staticSourceError={staticSourceError} />
          {sourceLoading ? (
            <HomeLoadingState />
          ) : sourceFailed ? null : !hasWorkspaceContent ? (
            <HomeEmptyState />
          ) : (
            <div className="home-workbench">
              <div className="home-feed" aria-label="Resume reading">
                <ContinueReadingCard hrefs={data.readableHrefs} starters={data.starters} />
              </div>

              <aside className="home-context" aria-label="Workspace context" data-context-panel>
                <AgentAskCard documentCount={data.readableHrefs.length} />
                <InboxTriageCard />
              </aside>

              <div className="home-secondary" aria-label="Library activity">
                <RecentEditsCard docs={data.recentDocs} />
                <RecentCollectionsRow groups={data.groups} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
