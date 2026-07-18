"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { FolderOpen, PlugZap, Rss, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import LocalConnectPanel from "@/components/integrations/LocalConnectPanel";
import LocalFolderPickerButton from "@/components/integrations/LocalFolderPickerButton";
import OnboardingReturnLink from "@/components/integrations/OnboardingReturnLink";
import RssSourceDetail, {
  formatRssSync,
  useSubscriptions,
} from "@/components/integrations/RssSourceDetail";
import { ContentHeader, ContentPage } from "@/components/layout/ContentPage";
import { ContentPanel, ContentSection, ContentStatus } from "@/components/ui/content-primitives";
import { Button, buttonVariants } from "@/components/ui/button";
import type { RawFileEntry } from "@/lib/content-source";
import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import {
  disconnectRuntimeLocalFolder,
  loadActiveRuntimeLocalFolder,
  listRuntimeLocalFolder,
} from "@/lib/runtime-local-folder";
import type { Subscription } from "@/lib/subscriptions";
import styles from "./Sources.module.css";

export type SourceStatus = "synced" | "syncing" | "disconnected";

export interface SourceRow {
  kind: string;
  name: string;
  detail: string;
  lastSync: string;
  items: number;
  status: SourceStatus;
  progress?: number;
  error?: string | null;
}

type RuntimeLocalStatus = "idle" | "loading" | "ready" | "error";

interface RuntimeLocalSource {
  status: RuntimeLocalStatus;
  folder: string | null;
  fileCount: number | null;
  folderCount: number | null;
  samplePaths: string[];
  error: string | null;
}

const STATUS_LABEL: Record<SourceStatus, string> = {
  synced: "Connected",
  syncing: "Checking",
  disconnected: "Not connected",
};

const SOURCE_ICONS: Record<string, LucideIcon> = {
  local: FolderOpen,
  rss: Rss,
};

const EMPTY_RUNTIME_LOCAL: RuntimeLocalSource = {
  status: "idle",
  folder: null,
  fileCount: null,
  folderCount: null,
  samplePaths: [],
  error: null,
};

function countFolders(entries: RawFileEntry[]): number {
  const folders = new Set<string>();
  for (const entry of entries) {
    for (let depth = 1; depth < entry.path.length; depth += 1) {
      folders.add(entry.path.slice(0, depth).join("/"));
    }
  }
  return folders.size;
}

function samplePaths(entries: RawFileEntry[]): string[] {
  return entries.slice(0, 5).map((entry) => entry.path.join("/"));
}

function useRuntimeLocalSource(): RuntimeLocalSource {
  const [folder, setFolder] = useState<string | null>(null);
  const [result, setResult] = useState<RuntimeLocalSource | null>(null);

  useEffect(() => {
    const refresh = () => setFolder(loadActiveRuntimeLocalFolder());
    refresh();
    window.addEventListener(LOCAL_FOLDER_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LOCAL_FOLDER_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (!folder) return;

    let cancelled = false;
    const activeFolder = folder;

    async function load() {
      try {
        const entries = await listRuntimeLocalFolder(activeFolder);
        if (cancelled) return;
        setResult({
          status: "ready",
          folder: activeFolder,
          fileCount: entries.length,
          folderCount: countFolders(entries),
          samplePaths: samplePaths(entries),
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setResult({
          status: "error",
          folder: activeFolder,
          fileCount: 0,
          folderCount: 0,
          samplePaths: [],
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [folder]);

  if (!folder) return EMPTY_RUNTIME_LOCAL;
  if (!result || result.folder !== folder) {
    return {
      status: "loading",
      folder,
      fileCount: null,
      folderCount: null,
      samplePaths: [],
      error: null,
    };
  }
  return result;
}

function runtimeStatusLabel(runtimeLocal: RuntimeLocalSource): string {
  if (runtimeLocal.status === "loading") return "Checking...";
  if (runtimeLocal.status === "error") return "Needs attention";
  if (runtimeLocal.status === "ready") return "Just now";
  return "Not checked";
}

function sourceCountLabel(source: SourceRow): string {
  const unit = source.kind === "rss" ? "feed" : "file";
  return `${source.items.toLocaleString()} ${unit}${source.items === 1 ? "" : "s"}`;
}

function sourcesWithRuntimeState(
  sources: SourceRow[],
  runtimeLocal: RuntimeLocalSource,
  subscriptions: readonly Subscription[]
): SourceRow[] {
  const folder = runtimeLocal.folder;
  return sources.map((source) => {
    if (source.kind === "rss") {
      const feedCount = subscriptions.length;
      const failedCount = subscriptions.filter(
        (subscription) => subscription.lastSyncErrorAt
      ).length;
      return {
        ...source,
        detail:
          failedCount > 0
            ? `${failedCount.toLocaleString()} feed${failedCount === 1 ? "" : "s"} needs attention`
            : feedCount > 0
              ? `${feedCount.toLocaleString()} RSS/Atom feed${feedCount === 1 ? "" : "s"} in Inbox`
              : "No feeds subscribed",
        lastSync: formatRssSync(subscriptions),
        items: feedCount,
        status: feedCount > 0 && failedCount === 0 ? "synced" : "disconnected",
      };
    }

    if (source.kind !== "local" || runtimeLocal.status === "idle" || !folder) return source;
    return {
      ...source,
      detail: folder,
      lastSync: runtimeStatusLabel(runtimeLocal),
      items: runtimeLocal.fileCount ?? source.items,
      status:
        runtimeLocal.status === "loading"
          ? "syncing"
          : runtimeLocal.status === "error"
            ? "disconnected"
            : "synced",
    };
  });
}

function fallbackSource(kind: "local" | "rss"): SourceRow {
  if (kind === "rss") {
    return {
      kind: "rss",
      name: "RSS",
      detail: "No feeds subscribed",
      lastSync: "-",
      items: 0,
      status: "disconnected",
    };
  }
  return {
    kind: "local",
    name: "Local Library",
    detail: "Choose a folder",
    lastSync: "-",
    items: 0,
    status: "disconnected",
  };
}

function SourceStatusPill({ source, label }: { source: SourceRow; label?: string }) {
  return (
    <span className={styles.status} data-status={source.status} role="status">
      <span className={styles.statusDot} aria-hidden />
      {source.status === "syncing" && source.progress != null
        ? `Checking ${source.progress}%`
        : (label ?? STATUS_LABEL[source.status])}
    </span>
  );
}

function SourceCardShell({
  source,
  description,
  statusLabel,
  children,
}: {
  source: SourceRow;
  description: string;
  statusLabel?: string;
  children: ReactNode;
}) {
  const Icon = SOURCE_ICONS[source.kind] ?? FolderOpen;
  return (
    <ContentSection
      className={styles.sourceSection}
      id={source.kind === "local" ? "local-files" : "rss-feeds"}
      title={
        <span className={styles.sectionTitle}>
          <span className={styles.sourceIcon} aria-hidden>
            <Icon />
          </span>
          {source.name}
        </span>
      }
      description={description}
      actions={<SourceStatusPill source={source} label={statusLabel} />}
    >
      <ContentPanel variant="plain" className={styles.sourcePanel}>
        {children}
      </ContentPanel>
    </ContentSection>
  );
}

function LocalSourceCard({
  source,
  runtimeLocal,
  folder,
  setFolder,
}: {
  source: SourceRow;
  runtimeLocal: RuntimeLocalSource;
  folder: string;
  setFolder: (folder: string) => void;
}) {
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const disconnectingRef = useRef(false);
  const hasRuntimeFolder = runtimeLocal.folder !== null;
  const configuredAtBuild =
    !hasRuntimeFolder && (source.status === "synced" || Boolean(source.error));
  const sourceReadError =
    runtimeLocal.status === "error" ? runtimeLocal.error : !hasRuntimeFolder ? source.error : null;
  const folderLabel = runtimeLocal.folder ?? folder;
  const description = sourceReadError
    ? "Verto found configured content, but the source could not be read. Resolve the error before relying on this Library."
    : configuredAtBuild
      ? "This build includes configured Markdown and MDX content. Connect a device folder to use it as the live Library."
      : "Use a folder of Markdown or MDX files as the live Library. Nested folders keep their structure.";

  async function disconnect() {
    if (disconnectingRef.current) return;
    disconnectingRef.current = true;
    setDisconnecting(true);
    let disconnected = false;
    try {
      await disconnectRuntimeLocalFolder();
      disconnected = loadActiveRuntimeLocalFolder() === null;
      if (!disconnected) {
        toast.error("Could not disconnect the local library", {
          description: "The local library is still active. Try again.",
        });
      }
    } catch (error) {
      disconnected = loadActiveRuntimeLocalFolder() === null;
      if (!disconnected) {
        const message = error instanceof Error ? error.message : String(error);
        toast.error("Could not disconnect the local library", { description: message });
      }
    } finally {
      disconnectingRef.current = false;
      setDisconnecting(false);
    }

    if (!disconnected) return;
    setFolder("");
    setConfirmDisconnect(false);
    toast.success("Local library disconnected", {
      description: "No files were deleted. Reconnect it from Recent folders at any time.",
    });
  }

  return (
    <SourceCardShell
      source={source}
      description={description}
      statusLabel={
        sourceReadError ? "Needs attention" : configuredAtBuild ? "Included in build" : undefined
      }
    >
      <dl className={styles.metrics}>
        <div className={styles.metricWide}>
          <dt>{configuredAtBuild ? "Configured content" : "Folder"}</dt>
          <dd>
            <code title={configuredAtBuild ? source.detail : folderLabel}>
              {configuredAtBuild ? source.detail : folderLabel || "No folder selected"}
            </code>
          </dd>
        </div>
        <div>
          <dt>Readable files</dt>
          <dd>{sourceCountLabel(source)}</dd>
        </div>
        <div>
          <dt>Subfolders</dt>
          <dd>
            {runtimeLocal.folderCount == null ? "-" : runtimeLocal.folderCount.toLocaleString()}
          </dd>
        </div>
      </dl>

      {sourceReadError ? (
        <div className={styles.statusBlock}>
          <ContentStatus
            status="error"
            title={
              hasRuntimeFolder
                ? "Verto could not read this folder"
                : "Verto could not read configured content"
            }
            description={sourceReadError}
          />
        </div>
      ) : null}

      {runtimeLocal.samplePaths.length > 0 ? (
        <div className={styles.preview}>
          <strong>Folder preview</strong>
          <ul>
            {runtimeLocal.samplePaths.map((sample) => (
              <li key={sample}>{sample}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className={styles.hint}>
          {sourceReadError
            ? "Retry after fixing the source configuration, or connect a device folder below."
            : configuredAtBuild
              ? "The bundled content is ready. Connect a device folder to preview and open local files."
              : hasRuntimeFolder
                ? "This folder has no readable Markdown or MDX files yet."
                : "Choose a folder below, then connect it after reviewing the selection."}
        </p>
      )}

      <div className={styles.primaryActions}>
        <Button asChild variant="outline" size="sm">
          <Link href="/library">Open Library</Link>
        </Button>
        {hasRuntimeFolder ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={styles.dangerButton}
            onClick={() => setConfirmDisconnect(true)}
          >
            Disconnect
          </Button>
        ) : null}
      </div>

      {confirmDisconnect ? (
        <div className={styles.disconnectPrompt}>
          <ContentStatus
            title="Disconnect this local library?"
            description="Verto will finish pending saves first. Files, recent-folder history, and portable state stay in the folder."
            action={
              <div className={styles.promptActions}>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={disconnecting}
                  aria-busy={disconnecting}
                  onClick={() => void disconnect()}
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disconnecting}
                  onClick={() => setConfirmDisconnect(false)}
                >
                  Cancel
                </Button>
              </div>
            }
          />
        </div>
      ) : null}

      <div className={styles.manager}>
        <LocalConnectPanel
          folder={folder}
          connectedFolder={runtimeLocal.folder}
          onFolderChange={setFolder}
          showTitle={false}
        />
      </div>
    </SourceCardShell>
  );
}

function RssSourceCard({
  source,
  subscriptions,
}: {
  source: SourceRow;
  subscriptions: readonly Subscription[];
}) {
  const failedCount = subscriptions.filter((subscription) => subscription.lastSyncErrorAt).length;
  return (
    <SourceCardShell
      source={source}
      description="Follow RSS or Atom feeds. New items appear in Inbox, separate from the local Library."
      statusLabel={failedCount > 0 ? "Needs attention" : undefined}
    >
      <RssSourceDetail subscriptions={subscriptions} lastSync={source.lastSync} />
    </SourceCardShell>
  );
}

export default function SourcesOverview({ sources }: { sources: SourceRow[] }) {
  const runtimeLocal = useRuntimeLocalSource();
  const subscriptions = useSubscriptions();
  const [localFolderOverride, setLocalFolderOverride] = useState<string | null>(null);
  const localFolder = localFolderOverride ?? runtimeLocal.folder ?? "";

  const activeSources = useMemo(
    () => sourcesWithRuntimeState(sources, runtimeLocal, subscriptions),
    [runtimeLocal, sources, subscriptions]
  );

  const localSource =
    activeSources.find((source) => source.kind === "local") ?? fallbackSource("local");
  const rssSource = activeSources.find((source) => source.kind === "rss") ?? fallbackSource("rss");

  return (
    <ContentPage width="standard">
      <ContentHeader
        title="Sources & Integrations"
        description="Manage the local Library and RSS feeds Verto can read today."
        icon={<PlugZap />}
        actions={
          <>
            <OnboardingReturnLink />
            <Button asChild variant="outline" size="sm">
              <Link href="/inbox">Manage RSS</Link>
            </Button>
            <LocalFolderPickerButton
              className={buttonVariants({ variant: "default", size: "sm" })}
              onConnected={() => setLocalFolderOverride(null)}
            />
          </>
        }
      />

      <div className={styles.workbench} aria-label="Source connections">
        <LocalSourceCard
          source={localSource}
          runtimeLocal={runtimeLocal}
          folder={localFolder}
          setFolder={setLocalFolderOverride}
        />
        <RssSourceCard source={rssSource} subscriptions={subscriptions} />
      </div>
    </ContentPage>
  );
}
