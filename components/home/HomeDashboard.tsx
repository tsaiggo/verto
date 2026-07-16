"use client";

import { useEffect, useRef } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FileSearch,
  Files,
  Loader2,
  MessageSquareText,
  ScanText,
  SearchCheck,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ContinueReadingCard from "@/components/home/ContinueReadingCard";
import HomeCommandComposer from "@/components/home/HomeCommandComposer";
import HomeEnvironmentCard from "@/components/home/HomeEnvironmentCard";
import {
  InboxTriageCard,
  RecentCollectionsRow,
  RecentEditsCard,
} from "@/components/home/HomeCards";
import { runtimeHomeWorkspace, type HomeWorkspaceData } from "@/components/home/home-data";
import { useRuntimeLocalIndex } from "@/components/runtime/useRuntimeLocalIndex";
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

function ThreadEvent({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="codex-thread-event">
      <Icon aria-hidden />
      <span>{label}</span>
    </div>
  );
}

type ReviewStatus = "idle" | "loading" | "ready" | "error";

function activityLabel(
  status: ReviewStatus,
  ready: string,
  loading: string,
  error: string
): string {
  if (status === "loading") return loading;
  if (status === "error") return error;
  return ready;
}

function ReviewAudit({ status }: { status: ReviewStatus }) {
  const finished = status !== "loading" && status !== "error";
  return (
    <div className="codex-thread-audit" aria-label="Workspace review status">
      <span>
        <ScanText aria-hidden /> Library review
      </span>
      <span>
        <Files aria-hidden /> Content map
      </span>
      <span>
        <MessageSquareText aria-hidden /> Reading context
      </span>
      <span className={finished ? "is-finished" : "is-pending"}>
        {status === "loading" ? (
          <Loader2 aria-hidden className="home-source-status-icon" />
        ) : status === "error" ? (
          <TriangleAlert aria-hidden />
        ) : (
          <CheckCircle2 aria-hidden />
        )}
        {activityLabel(status, "finished", "reviewing", "needs attention")}
      </span>
    </div>
  );
}

function WorkspaceResult({
  data,
  source,
  title,
  copy,
}: {
  data: HomeWorkspaceData;
  source: RuntimeSourceHeaderSummary;
  title: string;
  copy: string;
}) {
  return (
    <section className="codex-thread-result" aria-labelledby="codex-thread-result-title">
      <h1 id="codex-thread-result-title">{title}</h1>
      <p>{copy}</p>
      <details className="codex-thread-library-summary">
        <summary>
          <Files aria-hidden />
          <span>Workspace overview</span>
          <small>{source.documentLabel}</small>
          <ChevronRight aria-hidden />
        </summary>
        <div className="home-workbench">
          <div className="home-feed" aria-label="Workspace overview">
            <ContinueReadingCard hrefs={data.readableHrefs} starters={data.starters} />
            <InboxTriageCard />
            <RecentEditsCard docs={data.recentDocs} />
            <RecentCollectionsRow groups={data.groups} />
          </div>
        </div>
      </details>
    </section>
  );
}

function HomeTaskTranscript({
  data,
  source,
  status,
  resultTitle,
  resultCopy,
}: {
  data: HomeWorkspaceData;
  source: RuntimeSourceHeaderSummary;
  status: ReviewStatus;
  resultTitle: string;
  resultCopy: string;
}) {
  return (
    <article className="codex-thread-transcript" aria-label="Workspace task">
      <p className="codex-thread-opening">
        Review this library, surface the useful reading paths, and keep the source context close at
        hand.
      </p>
      <ThreadEvent
        icon={FileSearch}
        label={activityLabel(
          status,
          "Indexed the available library structure",
          "Indexing the available library structure",
          "Could not index the selected library"
        )}
      />
      <p className="codex-thread-response">
        I am treating the active content source as the working environment, then checking its
        readable documents, sections, and recent activity before presenting the next reading paths.
      </p>
      <ThreadEvent
        icon={ScanText}
        label={activityLabel(
          status,
          `Mapped ${source.documentLabel} across ${source.sectionLabel}`,
          "Mapping documents and collections",
          "Content map unavailable"
        )}
      />
      <ThreadEvent
        icon={BookOpen}
        label={activityLabel(
          status,
          "Loaded reader links and source context",
          "Preparing reader links and source context",
          "Reader links are waiting for a source"
        )}
      />
      <p className="codex-thread-response">
        The workspace is using real library data. Source links remain available from the rail, the
        task environment, and the composer so the wide task canvas does not remove any Verto
        workflow.
      </p>
      <ReviewAudit status={status} />
      <ThreadEvent
        icon={Files}
        label={activityLabel(
          status,
          "Used the library index and source metadata",
          "Reading the library index and source metadata",
          "Library index unavailable"
        )}
      />
      <ThreadEvent
        icon={BookOpen}
        label={activityLabel(
          status,
          "Loaded recent documents and reading paths",
          "Loading recent documents and reading paths",
          "Recent documents unavailable"
        )}
      />
      <ThreadEvent
        icon={FileSearch}
        label={activityLabel(
          status,
          "Loaded saved reading activity",
          "Loading saved reading activity",
          "Saved reading activity remains available"
        )}
      />
      <p className="codex-thread-worked">
        {activityLabel(status, "Workspace reviewed", "Reviewing workspace", "Review interrupted")}{" "}
        <ChevronRight aria-hidden />
      </p>
      <WorkspaceResult data={data} source={source} title={resultTitle} copy={resultCopy} />
      <ThreadEvent icon={ScanText} label="Kept task and source controls available" />
      <ThreadEvent
        icon={SearchCheck}
        label={activityLabel(
          status,
          "Workspace search is ready",
          "Preparing workspace search",
          "Workspace search needs attention"
        )}
      />
    </article>
  );
}

interface HomeDashboardProps {
  staticData: HomeWorkspaceData;
  sourceLabel: string;
}

export default function HomeDashboard({ staticData, sourceLabel }: HomeDashboardProps) {
  const runtime = useRuntimeLocalIndex();
  const scrollRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  const resultTitle = activityLabel(
    runtime.status,
    "Your Verto library is ready",
    "Opening your Verto library",
    "Your library needs attention"
  );
  const resultCopy = activityLabel(
    runtime.status,
    "Continue where you left off, inspect recent edits, or open a collection. The task environment keeps the active source close without shrinking the workspace.",
    "Verto is reading the selected folder and rebuilding the local content map.",
    "The selected local folder could not be read. Review the source and try again."
  );
  const data =
    runtime.status === "ready"
      ? runtimeHomeWorkspace(runtime.index.documents.map((document) => document.node))
      : runtime.status === "idle"
        ? staticData
        : EMPTY_HOME;
  const sourceSummary = resolveRuntimeSourceHeader(runtime, {
    documents: staticData.readableHrefs.length,
    sections: staticData.groups.length,
  });

  useEffect(() => {
    const scrollOwner = scrollRef.current;
    if (!scrollOwner) return;
    if (didInitialScroll.current) {
      const distanceFromBottom =
        scrollOwner.scrollHeight - scrollOwner.scrollTop - scrollOwner.clientHeight;
      if (distanceFromBottom > 120) return;
    }
    scrollOwner.scrollTop = scrollOwner.scrollHeight;
    didInitialScroll.current = true;
  }, [runtime.status]);

  return (
    <div className="home-scroll codex-thread-home">
      <div className="codex-thread-frame">
        <HomeEnvironmentCard documents={data.recentDocs} source={sourceSummary} />

        <div ref={scrollRef} className="codex-thread-scroll" data-page-scroll>
          <HomeTaskTranscript
            data={data}
            source={sourceSummary}
            status={runtime.status}
            resultTitle={resultTitle}
            resultCopy={resultCopy}
          />
        </div>

        <HomeCommandComposer
          sourceLabel={runtime.status === "ready" ? runtime.folder : sourceLabel}
          statusLabel={`${activityLabel(
            runtime.status,
            "Library review",
            "Reviewing library",
            "Library unavailable"
          )} · ${sourceSummary.documentLabel}`}
        />
      </div>
    </div>
  );
}
