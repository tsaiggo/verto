"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, FolderOpen, HardDrive, Rss, type LucideIcon } from "lucide-react";
import LocalConnectPanel from "@/components/integrations/LocalConnectPanel";
import { LOCAL_FOLDER_CHANGED_EVENT } from "@/lib/local-folder";
import { loadActiveRuntimeLocalFolder, listRuntimeLocalFolder } from "@/lib/runtime-local-folder";
import RssSourceDetail, {
  formatRssSync,
  useSubscriptions,
} from "@/components/integrations/RssSourceDetail";
import type { RawFileEntry } from "@/lib/content-source";
import type { Subscription } from "@/lib/subscriptions";
import styles from "./Sources.module.css";

export type SourceStatus = "synced" | "syncing" | "disconnected" | "attention";

export interface SourceRow {
  kind: string;
  name: string;
  detail: string;
  lastSync: string;
  items: number;
  status: SourceStatus;
  progress?: number;
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
  syncing: "Indexing",
  disconnected: "Not set up",
  attention: "Needs attention",
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
  if (runtimeLocal.status === "loading") return "Indexing";
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
        status: failedCount > 0 ? "attention" : feedCount > 0 ? "synced" : "disconnected",
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
            ? "attention"
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
    <span className={styles.status} data-status={source.status}>
      <span className={styles.statusDot} aria-hidden />
      {source.status === "syncing" && source.progress != null
        ? `Indexing ${source.progress}%`
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
    <article
      className={styles.sourceSection}
      id={source.kind === "local" ? "local-files" : "rss-feeds"}
    >
      <header className={styles.sourceHead}>
        <span className={styles.sourceIcon} aria-hidden>
          <Icon />
        </span>
        <div className={styles.sourceTitle}>
          <div className={styles.sourceTitleRow}>
            <h2>{source.name}</h2>
            <SourceStatusPill source={source} label={statusLabel} />
          </div>
          <p>{description}</p>
        </div>
      </header>
      <div className={styles.sourceBody}>{children}</div>
    </article>
  );
}

function isPermissionError(message: string): boolean {
  return /permission|denied|access|authori[sz]/i.test(message);
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
  const hasRuntimeFolder = runtimeLocal.folder !== null;
  const configuredAtBuild = !hasRuntimeFolder && source.status === "synced";
  const folderLabel = runtimeLocal.folder ?? folder;
  const description = configuredAtBuild
    ? "This build includes configured Markdown and MDX content. Choose a folder to grant Verto access to files on this device."
    : "Point Verto at a folder of Markdown or MDX files. Subfolders stay visible in Library.";

  return (
    <SourceCardShell
      source={source}
      description={description}
      statusLabel={configuredAtBuild ? "Configured at build time" : undefined}
    >
      <div className={styles.localLayout}>
        <div className={styles.localSummary}>
          <div className={styles.meta}>
            <span className={styles.metaItem}>
              <strong>{configuredAtBuild ? "Configured content" : "Folder"}</strong>
              <code>{configuredAtBuild ? source.detail : folderLabel || "No folder selected"}</code>
            </span>
            <span className={styles.metaItem}>
              <strong>Readable files</strong>
              <span>{sourceCountLabel(source)}</span>
            </span>
            <span className={styles.metaItem}>
              <strong>Subfolders</strong>
              <span>
                {runtimeLocal.folderCount == null
                  ? "Not scanned"
                  : runtimeLocal.folderCount.toLocaleString()}
              </span>
            </span>
          </div>

          {runtimeLocal.status === "error" && runtimeLocal.error ? (
            <div className={styles.error} role="alert">
              <AlertTriangle aria-hidden />
              <span>
                <strong>
                  {isPermissionError(runtimeLocal.error)
                    ? "Folder access was lost"
                    : "Verto could not read this folder"}
                </strong>
                <span>
                  Your files were not changed. Choose the folder again to restore access and restart
                  indexing.
                </span>
              </span>
            </div>
          ) : null}

          {runtimeLocal.samplePaths.length > 0 ? (
            <div className={styles.preview}>
              <strong>Folder preview</strong>
              <ul className={styles.pathList}>
                {runtimeLocal.samplePaths.map((sample) => (
                  <li key={sample}>{sample}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className={styles.hint}>
              {runtimeLocal.status === "loading"
                ? "Reading folder names and indexing Markdown files. Files stay in place while this runs."
                : configuredAtBuild
                  ? "The included content is ready. Choose a folder to add your own Markdown and MDX files."
                  : "Choose a folder to preview readable files and nested folders before opening the Library."}
            </p>
          )}

          <div className={styles.actions}>
            <Link href="/library" className="v-btn v-btn--sm">
              Open Library
            </Link>
          </div>
        </div>

        <div className={styles.manager}>
          <LocalConnectPanel folder={folder} onFolderChange={setFolder} showTitle={false} />
        </div>
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
      description="Follow RSS or Atom feeds. New items land in Inbox, separate from your local library."
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
    <div className={styles.page}>
      <aside className={styles.ownership} aria-label="File ownership">
        <span className={styles.ownershipIcon} aria-hidden>
          <HardDrive />
        </span>
        <div className={styles.ownershipCopy}>
          <strong>Your files stay in their folder</strong>
          <p>
            Verto indexes local Markdown and MDX without moving them. For cross-device access,
            choose a folder already synced by OneDrive, Dropbox, or another operating-system sync
            client.
          </p>
        </div>
      </aside>
      <section className={styles.stack} aria-label="Source connections">
        <LocalSourceCard
          source={localSource}
          runtimeLocal={runtimeLocal}
          folder={localFolder}
          setFolder={setLocalFolderOverride}
        />
        <RssSourceCard source={rssSource} subscriptions={subscriptions} />
      </section>
    </div>
  );
}
