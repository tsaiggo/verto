"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FileText, NotebookPen, SearchX } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { hydrateAnnotations, loadAnnotations, type Annotation } from "@/lib/annotations";
import { hydrateSummaries, loadSummaries, type SavedSummary } from "@/lib/summaries";
import { getStateStore } from "@/lib/state-store";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudioArtifactList } from "@/components/studio/StudioArtifactList";
import { StudioEvidencePanel } from "@/components/studio/StudioEvidencePanel";
import {
  buildStudioArtifacts,
  filterStudioArtifacts,
  type StudioView,
} from "@/components/studio/studio-artifacts";
import styles from "@/components/studio/Studio.module.css";

interface StudioSnapshot {
  summaries: SavedSummary[];
  annotations: Annotation[];
}

const EMPTY_SNAPSHOT = JSON.stringify({ summaries: [], annotations: [] });

function subscribe(callback: () => void) {
  return getStateStore().subscribe(callback);
}

function getSnapshot() {
  return JSON.stringify({
    summaries: loadSummaries().summaries,
    annotations: loadAnnotations().annotations,
  });
}

function getServerSnapshot() {
  return EMPTY_SNAPSHOT;
}

function emptyViewCopy(view: StudioView): {
  title: string;
  body: string;
  icon: typeof NotebookPen;
} {
  if (view === "summaries") {
    return {
      title: "No saved summaries",
      body: "Ask the Agent to summarize a document, then approve saving it to the Studio.",
      icon: FileText,
    };
  }
  if (view === "notes") {
    return {
      title: "No saved notes",
      body: "Select a passage in the reader and attach a note to keep its exact source here.",
      icon: NotebookPen,
    };
  }
  return {
    title: "No knowledge cards yet",
    body: "Save a grounded summary or a passage note while reading. Its source stays attached.",
    icon: NotebookPen,
  };
}

export default function StudioCards() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [view, setView] = useState<StudioView>("all");
  const [selectedKey, setSelectedKey] = useState(searchParams?.get("artifact") ?? "");
  const [hydrating, setHydrating] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([hydrateSummaries(), hydrateAnnotations()])
      .then(() => {
        if (active) setLoadError(false);
      })
      .catch(() => {
        if (active) setLoadError(true);
      })
      .finally(() => {
        if (active) setHydrating(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const artifacts = useMemo(() => {
    try {
      const parsed = JSON.parse(snapshot) as StudioSnapshot;
      return buildStudioArtifacts(parsed.summaries, parsed.annotations);
    } catch {
      return [];
    }
  }, [snapshot]);
  const filtered = useMemo(() => filterStudioArtifacts(artifacts, view), [artifacts, view]);
  const selected =
    filtered.find((artifact) => artifact.key === selectedKey) ?? filtered.at(0) ?? null;
  const summaryCount = artifacts.filter((artifact) => artifact.kind === "summary").length;
  const noteCount = artifacts.length - summaryCount;

  function updateSelection(key: string) {
    setSelectedKey(key);
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("artifact", key);
    router.replace(`/studio?${params.toString()}`, { scroll: false });
  }

  function updateView(nextView: string) {
    const normalized = nextView as StudioView;
    setView(normalized);
    const next = filterStudioArtifacts(artifacts, normalized).at(0);
    if (next) updateSelection(next.key);
  }

  if (hydrating) {
    return <StudioLoadingState />;
  }

  if (loadError && artifacts.length === 0) {
    return (
      <section className={styles.state} aria-labelledby="studio-load-error">
        <span className={styles.stateIcon} aria-hidden>
          <SearchX />
        </span>
        <h2 id="studio-load-error">Knowledge cards could not be restored</h2>
        <p>Verto could not read the local Studio data. Your source files are unchanged.</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </section>
    );
  }

  return (
    <Tabs value={view} onValueChange={updateView} className={styles.browser}>
      <TabsList className={styles.tabs} aria-label="Knowledge Studio views" data-page-tabs>
        <TabsTrigger value="all" className={styles.tab}>
          All insights
          {artifacts.length > 0 ? <span>{artifacts.length}</span> : null}
        </TabsTrigger>
        <TabsTrigger value="summaries" className={styles.tab}>
          Summaries
          {summaryCount > 0 ? <span>{summaryCount}</span> : null}
        </TabsTrigger>
        <TabsTrigger value="notes" className={styles.tab}>
          Notes
          {noteCount > 0 ? <span>{noteCount}</span> : null}
        </TabsTrigger>
      </TabsList>

      <TabsContent value={view} className={styles.panel}>
        <div className={styles.scroll} data-page-scroll>
          {filtered.length === 0 ? (
            <StudioEmptyState view={view} />
          ) : (
            <div className={styles.workbench}>
              <section className={styles.main} aria-label="Knowledge cards">
                <div className={styles.resultBar}>
                  <p aria-live="polite">
                    {filtered.length} {filtered.length === 1 ? "insight" : "insights"}
                  </p>
                  <p>Newest first</p>
                </div>
                <StudioArtifactList
                  artifacts={filtered}
                  selectedKey={selected?.key ?? null}
                  onSelect={updateSelection}
                />
              </section>
              <StudioEvidencePanel artifact={selected} />
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}

function StudioEmptyState({ view }: { view: StudioView }) {
  const copy = emptyViewCopy(view);
  const Icon = copy.icon;
  return (
    <section className={styles.state} aria-labelledby={`studio-empty-${view}`}>
      <span className={styles.stateIcon} aria-hidden>
        <Icon />
      </span>
      <h2 id={`studio-empty-${view}`}>{copy.title}</h2>
      <p>{copy.body}</p>
      <Button asChild variant="outline" size="sm">
        <Link href="/library">Open a document</Link>
      </Button>
    </section>
  );
}

export function StudioLoadingState() {
  return (
    <div
      className={styles.loadingWorkspace}
      role="status"
      aria-label="Loading Knowledge Studio"
      aria-busy="true"
    >
      <div className={styles.loadingRows}>
        {Array.from({ length: 5 }, (_, index) => (
          <div className={styles.loadingRow} key={index}>
            <span className={styles.loadingIcon} />
            <span className={styles.loadingCopy}>
              <span />
              <span />
              <span />
            </span>
          </div>
        ))}
      </div>
      <div className={styles.loadingEvidence}>
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
