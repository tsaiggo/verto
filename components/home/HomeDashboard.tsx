"use client";

import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  FolderClosed,
  HardDrive,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import ContinueReadingCard from "@/components/home/ContinueReadingCard";
import HomeCommandComposer from "@/components/home/HomeCommandComposer";
import {
  InboxTriageCard,
  RecentCollectionsRow,
  RecentEditsCard,
  SavedBookmarksCard,
} from "@/components/home/HomeCards";
import { runtimeHomeWorkspace, type HomeWorkspaceData } from "@/components/home/home-data";
import { useRuntimeLocalIndex } from "@/components/runtime/useRuntimeLocalIndex";
import type { SourceInfo } from "@/lib/source-info";
import {
  resolveRuntimeSourceHeader,
  type RuntimeSourceHeaderSummary,
} from "@/lib/runtime-source-header";

const EMPTY_HOME: HomeWorkspaceData = {
  groups: [],
  recentDocs: [],
  starters: [],
  readableHrefs: [],
};

type HomeStatus = "idle" | "loading" | "ready" | "error";

function homeHeading(source: RuntimeSourceHeaderSummary): string {
  switch (source.mode) {
    case "bundled":
      return "Explore the included demo";
    case "build":
      return "Your library is ready";
    case "local-loading":
      return "Opening your local library";
    case "local-error":
      return "Your local library needs attention";
    case "local-ready":
      return "Your local library is ready";
  }
}

function homeDescription(source: RuntimeSourceHeaderSummary): string {
  switch (source.mode) {
    case "bundled":
      return "Start with the included document or connect your own folder. Reading progress, bookmarks, and inbox activity below come from this device.";
    case "build":
      return "Continue from saved reading progress, revisit bookmarks, or review your inbox. Every document link below comes from the configured build source.";
    case "local-loading":
      return "Verto is indexing the selected folder. Your saved bookmarks and inbox remain available while the library opens.";
    case "local-error":
      return "The selected folder could not be indexed. Manage the source to reconnect it; device-saved bookmarks and inbox activity remain available.";
    case "local-ready":
      return "Continue from saved reading progress, revisit bookmarks, or review your inbox. Every document link below comes from the active folder.";
  }
}

function sourceStateLabel(status: HomeStatus, source: RuntimeSourceHeaderSummary): string {
  switch (status) {
    case "loading":
      return "Indexing";
    case "error":
      return "Needs attention";
    case "idle":
      return source.mode === "bundled" ? "Demo" : "Ready";
    case "ready":
      return "Ready";
  }
}

function SourceStatus({
  source,
  status,
}: {
  source: RuntimeSourceHeaderSummary;
  status: HomeStatus;
}) {
  const Icon = status === "loading" ? Loader2 : status === "error" ? TriangleAlert : CheckCircle2;
  const stateClass =
    status === "loading" ? "is-loading" : status === "error" ? "is-error" : "is-ready";

  return (
    <div
      className={`home-source-status ${stateClass}`}
      role={status === "error" ? "alert" : "status"}
    >
      <Icon className="home-source-status-icon" aria-hidden />
      <span>
        <strong>{source.sourceLabel}</strong> · {source.documentLabel} · {source.sectionLabel}
      </span>
      {status === "error" ? <Link href="/integrations">Manage source</Link> : null}
    </div>
  );
}

function WorkspaceOverview({
  data,
  source,
  status,
}: {
  data: HomeWorkspaceData;
  source: RuntimeSourceHeaderSummary;
  status: HomeStatus;
}) {
  const StatusIcon =
    status === "loading" ? Loader2 : status === "error" ? TriangleAlert : CheckCircle2;
  const finished = status === "idle" || status === "ready";

  return (
    <article className="codex-thread-transcript" aria-label="Workspace overview">
      <section className="codex-thread-result" aria-labelledby="home-workspace-title">
        <h1 id="home-workspace-title">{homeHeading(source)}</h1>
        <p>{homeDescription(source)}</p>

        <div className="codex-thread-audit" aria-label="Active workspace source">
          <span title={source.sourceTitle}>
            <HardDrive aria-hidden />
            {source.sourceLabel}
          </span>
          <span>
            <BookOpen aria-hidden />
            {source.documentLabel}
          </span>
          <span>
            <FolderClosed aria-hidden />
            {source.sectionLabel}
          </span>
          <span className={finished ? "is-finished" : "is-pending"}>
            <StatusIcon
              aria-hidden
              className={status === "loading" ? "home-source-status-icon" : undefined}
            />
            {sourceStateLabel(status, source)}
          </span>
        </div>

        {status === "loading" || status === "error" ? (
          <SourceStatus source={source} status={status} />
        ) : null}

        <div className="home-workbench">
          <div className="home-feed" aria-label="Saved workspace activity">
            <ContinueReadingCard hrefs={data.readableHrefs} starters={data.starters} />
            <SavedBookmarksCard />
            <InboxTriageCard />
            <RecentEditsCard docs={data.recentDocs} />
            <RecentCollectionsRow groups={data.groups} />
          </div>
        </div>
      </section>
    </article>
  );
}

interface HomeDashboardProps {
  staticData: HomeWorkspaceData;
  source: SourceInfo;
}

export default function HomeDashboard({ staticData, source }: HomeDashboardProps) {
  const runtime = useRuntimeLocalIndex();
  const data =
    runtime.status === "ready"
      ? runtimeHomeWorkspace(runtime.index.documents.map((document) => document.node))
      : runtime.status === "idle"
        ? staticData
        : EMPTY_HOME;
  const sourceSummary = resolveRuntimeSourceHeader(runtime, {
    source,
    documents: staticData.readableHrefs.length,
    sections: staticData.groups.length,
  });
  const composerStatus =
    runtime.status === "loading"
      ? `${sourceSummary.sourceLabel} · indexing`
      : runtime.status === "error"
        ? `${sourceSummary.sourceLabel} · unavailable`
        : `${sourceSummary.sourceLabel} · ${sourceSummary.documentLabel}`;

  return (
    <div className="home-scroll codex-thread-home">
      <div className="codex-thread-frame">
        <div className="codex-thread-scroll" data-page-scroll>
          <WorkspaceOverview data={data} source={sourceSummary} status={runtime.status} />
        </div>

        <HomeCommandComposer sourceLabel={sourceSummary.sourceLabel} statusLabel={composerStatus} />
      </div>
    </div>
  );
}
