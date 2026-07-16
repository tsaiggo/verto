"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FileText,
  FolderOpen,
  Globe2,
  HardDrive,
  LibraryBig,
  Loader2,
  MessageSquareText,
  Plus,
  Settings2,
  TriangleAlert,
  X,
} from "lucide-react";
import type { RecentDoc } from "@/components/home/home-data";
import { useEnvironmentPanel } from "@/components/state/EnvironmentPanelState";
import type { RuntimeSourceHeaderSummary } from "@/lib/runtime-source-header";

interface HomeEnvironmentCardProps {
  documents: RecentDoc[];
  source: RuntimeSourceHeaderSummary;
}

function SourceStatusIcon({ mode }: { mode: RuntimeSourceHeaderSummary["mode"] }) {
  if (mode === "local-loading") return <Loader2 className="is-spinning" aria-hidden />;
  if (mode === "local-error") return <TriangleAlert className="is-error" aria-hidden />;
  return <CheckCircle2 className="is-ready" aria-hidden />;
}

function sourceStatusLabel(mode: RuntimeSourceHeaderSummary["mode"]): string {
  if (mode === "local-loading") return "Reading folder";
  if (mode === "local-error") return "Source unavailable";
  if (mode === "local-ready") return "Local folder ready";
  return "Included library ready";
}

function subscribeToBrowserLocation(): () => void {
  return () => undefined;
}

export default function HomeEnvironmentCard({ documents, source }: HomeEnvironmentCardProps) {
  const panel = useEnvironmentPanel();
  const browserHost = useSyncExternalStore(
    subscribeToBrowserLocation,
    () => window.location.host,
    () => "Verto app"
  );

  useEffect(() => {
    if (!panel?.open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") panel.setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [panel]);

  if (panel && !panel.open) return null;
  const visibleDocuments = documents.slice(0, 2);

  return (
    <aside className="codex-environment-panel" aria-label="Task environment" data-home-environment>
      <header className="codex-environment-header">
        <span>Environment</span>
        <div className="codex-environment-header-actions">
          <Link href="/integrations" aria-label="Add content source">
            <Plus aria-hidden />
          </Link>
          <button
            type="button"
            className="codex-environment-close"
            aria-label="Close environment"
            onClick={() => panel?.setOpen(false)}
          >
            <X aria-hidden />
          </button>
        </div>
      </header>

      <section className="codex-environment-section" aria-label="Workspace source">
        <Link href="/library" className="codex-environment-row">
          <LibraryBig aria-hidden />
          <span>Library</span>
          <strong>{source.documentLabel}</strong>
        </Link>

        <details className="codex-environment-details" open>
          <summary className="codex-environment-row">
            <HardDrive aria-hidden />
            <span>Local</span>
            <ChevronDown className="codex-environment-chevron" aria-hidden />
          </summary>
          <div className="codex-environment-detail-rows">
            <div className="codex-environment-row is-detail" title={source.sourceTitle}>
              <FolderOpen aria-hidden />
              <span>{source.sourceLabel}</span>
            </div>
            <Link href="/integrations" className="codex-environment-row is-detail">
              <Settings2 aria-hidden />
              <span>Manage sources</span>
            </Link>
            <Link href="/library" className="codex-environment-row is-detail">
              <BookOpen aria-hidden />
              <span>Open library</span>
            </Link>
          </div>
        </details>
      </section>

      <section className="codex-environment-section" aria-labelledby="codex-environment-agent">
        <div className="codex-environment-section-head">
          <span id="codex-environment-agent">Agent</span>
        </div>
        <div className="codex-environment-agent-row">
          <span className="codex-environment-agent-icons" aria-hidden>
            <MessageSquareText />
            <LibraryBig />
            <FileText />
          </span>
          <span>{sourceStatusLabel(source.mode)}</span>
          <strong>{source.sectionLabel}</strong>
          <SourceStatusIcon mode={source.mode} />
        </div>
      </section>

      <section className="codex-environment-section" aria-labelledby="codex-environment-browser">
        <div className="codex-environment-section-head">
          <span id="codex-environment-browser">Browser</span>
        </div>
        <Link href="/" className="codex-environment-browser-row">
          <Globe2 aria-hidden />
          <span>Verto</span>
          <small>{browserHost}</small>
        </Link>
      </section>

      <section className="codex-environment-section" aria-labelledby="codex-environment-sources">
        <div className="codex-environment-section-head">
          <span id="codex-environment-sources">Sources</span>
          <Link href="/integrations" aria-label="Manage sources">
            <Plus aria-hidden />
          </Link>
        </div>
        <div className="codex-environment-source-list">
          {visibleDocuments.map((document) => (
            <Link key={document.href} href={document.href} title={document.title}>
              <FileText aria-hidden />
              <span>{document.title}</span>
            </Link>
          ))}
          {visibleDocuments.length < 2 ? (
            <Link href="/library">
              <LibraryBig aria-hidden />
              <span>Library index</span>
            </Link>
          ) : null}
          {visibleDocuments.length === 0 ? (
            <Link href="/integrations">
              <Settings2 aria-hidden />
              <span>Source settings</span>
            </Link>
          ) : null}
          <Link href="/integrations" title={source.sourceTitle ?? source.sourceLabel}>
            <FolderOpen aria-hidden />
            <span>{source.sourceLabel}</span>
          </Link>
        </div>
        <Link href="/library" className="codex-environment-view-all">
          <BookOpen aria-hidden />
          <span>View all</span>
        </Link>
      </section>
    </aside>
  );
}
