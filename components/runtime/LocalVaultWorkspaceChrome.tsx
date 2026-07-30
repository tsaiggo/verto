"use client";

import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import {
  CheckCircle2,
  Clock3,
  FileText,
  FolderOpen,
  Link2,
  ListTree,
  MessageSquareText,
  NotebookPen,
  PanelRight,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  X,
} from "lucide-react";

import AssistantPanel from "@/components/assistant/AssistantPanel";
import { LocalMdxWorkspace } from "@/components/workspace/LocalMdxWorkspace";
import { getAssistantConfig } from "@/lib/ai";
import { formatReadingTime } from "@/lib/reading-time";
import { runtimeFileLabel } from "@/lib/runtime-reader-source";
import { extractTOC } from "@/lib/toc";
import { readVertoDocumentMetadata } from "@/lib/vault-document";
import type { SummaryDocRef } from "@/lib/summaries";

import styles from "./RuntimeLocalReader.module.css";
import type { LocalVaultDocumentLoadState } from "./useRuntimeLocalWorkspace";

interface LocalVaultDocumentCanvasProps {
  desktop: boolean;
  documentTitle: string;
  file: string;
  folderError: string | null;
  format: "md" | "mdx";
  hasVault: boolean;
  isPickingFolder: boolean;
  onChooseFolder: () => void;
  onRetry: () => Promise<string>;
  onSave: (payload: { source: string; forceOverwrite?: boolean }) => Promise<void>;
  state: LocalVaultDocumentLoadState | null;
}

export function LocalVaultDocumentCanvas({
  desktop,
  documentTitle,
  file,
  folderError,
  format,
  hasVault,
  isPickingFolder,
  onChooseFolder,
  onRetry,
  onSave,
  state,
}: LocalVaultDocumentCanvasProps) {
  if (!hasVault) {
    return (
      <EmptyCanvas
        detail="Verto keeps your pages as ordinary Markdown and MDX files. Pick a folder once; OneDrive, Dropbox, or any sync tool can handle the rest."
        error={folderError}
        isBusy={isPickingFolder}
        busyLabel="Opening folder…"
        onAction={onChooseFolder}
        title="Open a local folder"
      />
    );
  }

  if (!file) {
    return (
      <EmptyCanvas
        detail="Choose a page from the library. When you want a blank document, use New page in the library."
        title="Choose a page to begin"
      />
    );
  }

  if (!state || state.status === "loading" || state.file !== file) {
    return <LocalVaultLoadingCanvas title={documentTitle} />;
  }

  if (state.status === "error") {
    return (
      <EmptyCanvas
        actionLabel="Retry page"
        actionIcon="retry"
        detail={state.message}
        onAction={() => {
          void onRetry().catch(() => undefined);
        }}
        title="This page could not be opened"
        tone="error"
      />
    );
  }

  return (
    <div className={styles.documentCanvas}>
      <LocalMdxWorkspace
        key={file}
        appearance="document"
        fileId={file}
        format={format}
        initialMode="read"
        isDesktop={desktop}
        onReloadFromDisk={onRetry}
        onSave={desktop ? onSave : undefined}
        source={state.source}
        title={documentTitle}
      />
    </div>
  );
}

export function LocalVaultLoadingCanvas({ title }: { title: string }) {
  return (
    <div className={styles.loadingCanvas} aria-busy="true" aria-live="polite">
      <div className={styles.loadingLine} />
      <div className={`${styles.loadingLine} ${styles.loadingTitle}`} />
      <div className={`${styles.loadingLine} ${styles.loadingParagraph}`} />
      <div className={`${styles.loadingLine} ${styles.loadingParagraphShort}`} />
      <span className="sr-only">Opening {title}</span>
    </div>
  );
}

interface LocalVaultOutlineRailProps {
  file: string;
  format: "md" | "mdx";
  readingMinutes: number;
  source: string | null;
  toc: ReturnType<typeof extractTOC>;
  onSelectHeading: (id: string) => void;
}

export function LocalVaultOutlineRail({
  file,
  format,
  readingMinutes,
  source,
  toc,
  onSelectHeading,
}: LocalVaultOutlineRailProps) {
  const label = file
    ? runtimeFileLabel(file, titleFromPath(file), extensionFromPath(file))
    : "No page selected";
  const metadata = source ? readVertoDocumentMetadata(source) : null;

  return (
    <aside className={styles.outlineRail} aria-label="Page outline" data-context-panel>
      <header className={styles.inspectorHeading}>
        <span className={styles.inspectorTitle}>
          <ListTree aria-hidden />
          <span>On this page</span>
        </span>
      </header>

      <Tabs.Root className={styles.contextTabs} defaultValue="outline" orientation="horizontal">
        <Tabs.List className={styles.contextTabList} aria-label="Document context views">
          <Tabs.Trigger className={styles.contextTab} value="outline">
            <ListTree aria-hidden />
            <span>Outline</span>
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.contextTab} value="notes">
            <NotebookPen aria-hidden />
            <span>Notes</span>
          </Tabs.Trigger>
          <Tabs.Trigger className={styles.contextTab} value="links">
            <Link2 aria-hidden />
            <span>Links</span>
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content className={styles.contextPanel} value="outline">
          <section className={styles.inspectorSection} aria-labelledby="local-outline-heading">
            <h2 id="local-outline-heading">On this page</h2>
            {toc.length > 0 ? (
              <ol className={styles.outlineList}>
                {toc.map((item) => (
                  <li
                    key={item.id}
                    style={{ paddingLeft: `${Math.max(0, item.level - 2) * 12}px` }}
                  >
                    <button type="button" onClick={() => onSelectHeading(item.id)}>
                      {item.text}
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.inspectorEmpty}>Headings will appear here.</p>
            )}
          </section>

          <section className={styles.inspectorSection} aria-labelledby="local-page-details-heading">
            <h2 id="local-page-details-heading">Page details</h2>
            <dl className={styles.fileDetails}>
              <div>
                <dt>Location</dt>
                <dd title={label}>{label}</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>{format.toUpperCase()}</dd>
              </div>
              {source ? (
                <div>
                  <dt>Reading time</dt>
                  <dd>
                    <Clock3 aria-hidden /> {formatReadingTime(readingMinutes)}
                  </dd>
                </div>
              ) : null}
              {metadata?.updated ? (
                <div>
                  <dt>Last saved</dt>
                  <dd>
                    <CheckCircle2 aria-hidden /> {formatInspectorDate(metadata.updated)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
        </Tabs.Content>

        <Tabs.Content className={styles.contextPanel} value="notes">
          <ContextEmptyState
            icon={<NotebookPen aria-hidden />}
            title="No notes on this page"
            detail="Select a passage in the document to attach a note to its source."
          />
        </Tabs.Content>

        <Tabs.Content className={styles.contextPanel} value="links">
          <ContextEmptyState
            icon={<Link2 aria-hidden />}
            title="No linked pages yet"
            detail="Links to and from this document will appear here."
          />
        </Tabs.Content>
      </Tabs.Root>
    </aside>
  );
}

interface LocalVaultAgentRailProps {
  document: SummaryDocRef;
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
}

export function LocalVaultAgentRail({ document, open, onClose, onOpen }: LocalVaultAgentRailProps) {
  if (!open) {
    return (
      <aside
        id="local-agent-panel"
        className={styles.inspectorCollapsed}
        aria-label="Agent"
        data-agent-slot
      >
        <button
          type="button"
          className={styles.contextToggle}
          aria-controls="local-agent-panel"
          aria-expanded="false"
          onClick={onOpen}
          title="Open Agent"
        >
          <PanelRightOpen aria-hidden />
          <span className="sr-only">Open Agent</span>
        </button>
      </aside>
    );
  }

  return (
    <aside id="local-agent-panel" className={styles.inspector} aria-label="Agent" data-agent-slot>
      <header className={styles.inspectorHeading}>
        <span className={styles.inspectorTitle}>
          <PanelRight aria-hidden />
          <span>Agent</span>
        </span>
        <button
          type="button"
          className={styles.contextToggle}
          aria-controls="local-agent-panel"
          aria-expanded="true"
          onClick={onClose}
          title="Close Agent"
        >
          <PanelRightClose aria-hidden />
          <span className="sr-only">Close Agent</span>
        </button>
      </header>
      <div className={styles.agentPanel}>
        <ContextAgent document={document} />
      </div>
    </aside>
  );
}

function ContextEmptyState({
  detail,
  icon,
  title,
}: {
  detail: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className={styles.contextEmpty}>
      <span aria-hidden>{icon}</span>
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}

function ContextAgent({ document }: { document: SummaryDocRef }) {
  const config = getAssistantConfig();

  if (!config.enabled) {
    return (
      <div className={styles.agentUnavailable}>
        <span className={styles.agentIcon} aria-hidden>
          <MessageSquareText />
        </span>
        <h2>Ask from the source</h2>
        <p>
          Connect an AI provider to ask questions about this page. Requests start only after you
          send one.
        </p>
        <Link href="/settings/agent">Set up Agent</Link>
      </div>
    );
  }

  return <AssistantPanel doc={document} />;
}

function EmptyCanvas({
  actionLabel = "Choose local folder",
  actionIcon = "folder",
  busyLabel = "Opening folder…",
  detail,
  error,
  isBusy = false,
  onAction,
  title,
  tone = "default",
}: {
  actionLabel?: string;
  actionIcon?: "folder" | "retry";
  busyLabel?: string;
  detail: string;
  error?: string | null;
  isBusy?: boolean;
  onAction?: () => void;
  title: string;
  tone?: "default" | "error";
}) {
  return (
    <div className={styles.emptyCanvas} data-tone={tone}>
      <span className={styles.emptyIcon} aria-hidden>
        {tone === "error" ? <X /> : <FileText />}
      </span>
      <h1>{title}</h1>
      <p>{detail}</p>
      {error ? (
        <p className={styles.emptyError} role="alert">
          {error}
        </p>
      ) : null}
      {onAction ? (
        <button type="button" className={styles.primaryAction} onClick={onAction} disabled={isBusy}>
          {isBusy || actionIcon === "retry" ? (
            <RefreshCw className={isBusy ? styles.spinning : undefined} aria-hidden />
          ) : (
            <FolderOpen aria-hidden />
          )}
          {isBusy ? busyLabel : actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function formatFromExt(value: string): "md" | "mdx" {
  return value.toLowerCase().endsWith(".md") ? "md" : "mdx";
}

export function extensionFromPath(file: string): string {
  const match = file.match(/\.(mdx?|markdown)$/i);
  return match ? `.${match[1].toLowerCase()}` : ".mdx";
}

export function titleFromPath(file: string): string {
  const name = file.split(/[\\/]/).filter(Boolean).at(-1) ?? "Untitled";
  return name.replace(/\.(mdx?|markdown)$/i, "").replace(/[-_]+/g, " ") || name;
}

export function formatInspectorDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Unknown date";
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][date.getUTCMonth()];
  return `${month} ${date.getUTCDate()}`;
}
