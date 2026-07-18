import type { RawFileEntry } from "@/lib/content-source";
import { sameLocalFolder, type FolderInspection, type InspectionSummary } from "@/lib/local-folder";
import type { RuntimeLocalPickerMode } from "@/lib/runtime-local-folder";
import type { Subscription } from "@/lib/subscriptions";

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

export type RuntimeLocalStatus = "idle" | "loading" | "ready" | "error";

export interface RuntimeLocalSource {
  status: RuntimeLocalStatus;
  folder: string | null;
  fileCount: number | null;
  folderCount: number | null;
  samplePaths: string[];
  error: string | null;
}

export const EMPTY_RUNTIME_LOCAL: RuntimeLocalSource = {
  status: "idle",
  folder: null,
  fileCount: null,
  folderCount: null,
  samplePaths: [],
  error: null,
};

interface ActivationDependencies {
  activate: (folder: string) => Promise<FolderInspection>;
  readActive: () => string | null;
}

export interface ConfirmedLocalFolder {
  activeFolder: string;
  inspection: FolderInspection | null;
}

export async function activateAndConfirmLocalFolder(
  value: string,
  fallbackInspection: FolderInspection | null,
  dependencies: ActivationDependencies
): Promise<ConfirmedLocalFolder> {
  const candidate = value.trim();
  let inspection = fallbackInspection;

  try {
    inspection = await dependencies.activate(candidate);
  } catch (error) {
    const activeFolder = dependencies.readActive();
    if (!activeFolder || !sameLocalFolder(activeFolder, candidate)) throw error;
    return { activeFolder, inspection };
  }

  const activeFolder = dependencies.readActive();
  if (!activeFolder) throw new Error("Verto could not confirm the active local library.");
  if (!sameLocalFolder(activeFolder, candidate)) {
    throw new Error("The active local library changed before this connection finished. Try again.");
  }
  return { activeFolder, inspection };
}

export interface LocalConnectUiState {
  candidate: string;
  isAlreadyConnected: boolean;
  canConnect: boolean;
  connectHint: string;
}

export function deriveLocalConnectUi({
  folder,
  connectedFolder,
  pickerMode,
  hasChosenBrowserFolder,
}: {
  folder: string;
  connectedFolder: string | null;
  pickerMode: RuntimeLocalPickerMode;
  hasChosenBrowserFolder: boolean;
}): LocalConnectUiState {
  const candidate = folder.trim();
  const isAlreadyConnected = Boolean(
    candidate && connectedFolder && sameLocalFolder(candidate, connectedFolder)
  );
  const canConnect =
    candidate !== "" && !isAlreadyConnected && (pickerMode === "desktop" || hasChosenBrowserFolder);

  return {
    candidate,
    isAlreadyConnected,
    canConnect,
    connectHint: localConnectHint({
      candidate,
      isAlreadyConnected,
      pickerMode,
      hasChosenBrowserFolder,
    }),
  };
}

function localConnectHint({
  candidate,
  isAlreadyConnected,
  pickerMode,
  hasChosenBrowserFolder,
}: {
  candidate: string;
  isAlreadyConnected: boolean;
  pickerMode: RuntimeLocalPickerMode;
  hasChosenBrowserFolder: boolean;
}): string {
  if (pickerMode === "unavailable") {
    return "Folder selection is unavailable here. Open Verto desktop or a browser with folder access.";
  }
  if (!candidate) return "Choose a folder to review before connecting it.";
  if (isAlreadyConnected) return "This folder is already connected.";
  if (pickerMode === "browser" && !hasChosenBrowserFolder) {
    return "Choose this folder again so the browser can access its files.";
  }
  return "Connecting replaces the live Library without deleting either folder.";
}

export function connectDescription(mode: RuntimeLocalPickerMode): string {
  if (mode === "desktop") return "Library and Explorer now read from this folder.";
  if (mode === "browser") return "Library and Explorer now use the cached browser selection.";
  return "The local Library is ready.";
}

interface DisconnectDependencies {
  disconnect: () => Promise<void>;
  readActive: () => string | null;
}

export type DisconnectResult =
  | { status: "disconnected" }
  | { status: "still-active" }
  | { status: "failed"; message: string };

export async function disconnectAndConfirmLocalFolder(
  dependencies: DisconnectDependencies
): Promise<DisconnectResult> {
  try {
    await dependencies.disconnect();
    return dependencies.readActive() === null
      ? { status: "disconnected" }
      : { status: "still-active" };
  } catch (error) {
    if (dependencies.readActive() === null) return { status: "disconnected" };
    return {
      status: "failed",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export function countRuntimeFolders(entries: RawFileEntry[]): number {
  const folders = new Set<string>();
  for (const entry of entries) {
    for (let depth = 1; depth < entry.path.length; depth += 1) {
      folders.add(entry.path.slice(0, depth).join("/"));
    }
  }
  return folders.size;
}

export function sampleRuntimePaths(entries: RawFileEntry[]): string[] {
  return entries.slice(0, 5).map((entry) => entry.path.join("/"));
}

function runtimeStatusLabel(runtimeLocal: RuntimeLocalSource): string {
  if (runtimeLocal.status === "loading") return "Checking...";
  if (runtimeLocal.status === "error") return "Needs attention";
  if (runtimeLocal.status === "ready") return "Just now";
  return "Not checked";
}

export function sourcesWithRuntimeState(
  sources: SourceRow[],
  runtimeLocal: RuntimeLocalSource,
  subscriptions: readonly Subscription[],
  rssLastSync: string
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
        detail: rssSourceDetail(feedCount, failedCount),
        lastSync: rssLastSync,
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
      status: runtimeSourceStatus(runtimeLocal.status),
    };
  });
}

function rssSourceDetail(feedCount: number, failedCount: number): string {
  if (failedCount > 0) {
    return `${failedCount.toLocaleString()} feed${failedCount === 1 ? "" : "s"} needs attention`;
  }
  if (feedCount > 0) {
    return `${feedCount.toLocaleString()} RSS/Atom feed${feedCount === 1 ? "" : "s"} in Inbox`;
  }
  return "No feeds subscribed";
}

function runtimeSourceStatus(status: RuntimeLocalStatus): SourceStatus {
  if (status === "loading") return "syncing";
  if (status === "error") return "disconnected";
  return "synced";
}

export function fallbackSource(kind: "local" | "rss"): SourceRow {
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

export interface LocalSourcePresentation {
  hasRuntimeFolder: boolean;
  configuredAtBuild: boolean;
  sourceReadError: string | null;
  folderLabel: string;
  description: string;
  statusLabel: string | undefined;
  folderMetricLabel: string;
  folderMetricValue: string;
  errorTitle: string;
  emptyHint: string;
}

export function deriveLocalSourcePresentation(
  source: SourceRow,
  runtimeLocal: RuntimeLocalSource,
  folder: string
): LocalSourcePresentation {
  const hasRuntimeFolder = runtimeLocal.folder !== null;
  const configuredAtBuild =
    !hasRuntimeFolder && (source.status === "synced" || Boolean(source.error));
  const sourceReadError =
    runtimeLocal.status === "error"
      ? runtimeLocal.error
      : !hasRuntimeFolder
        ? (source.error ?? null)
        : null;
  const folderLabel = runtimeLocal.folder ?? folder;

  return {
    hasRuntimeFolder,
    configuredAtBuild,
    sourceReadError,
    folderLabel,
    description: localSourceDescription(sourceReadError, configuredAtBuild),
    statusLabel: sourceReadError
      ? "Needs attention"
      : configuredAtBuild
        ? "Included in build"
        : undefined,
    folderMetricLabel: configuredAtBuild ? "Configured content" : "Folder",
    folderMetricValue: configuredAtBuild ? source.detail : folderLabel || "No folder selected",
    errorTitle: hasRuntimeFolder
      ? "Verto could not read this folder"
      : "Verto could not read configured content",
    emptyHint: localSourceEmptyHint(sourceReadError, configuredAtBuild, hasRuntimeFolder),
  };
}

function localSourceDescription(
  sourceReadError: string | null,
  configuredAtBuild: boolean
): string {
  if (sourceReadError) {
    return "Verto found configured content, but the source could not be read. Resolve the error before relying on this Library.";
  }
  if (configuredAtBuild) {
    return "This build includes configured Markdown and MDX content. Connect a device folder to use it as the live Library.";
  }
  return "Use a folder of Markdown or MDX files as the live Library. Nested folders keep their structure.";
}

function localSourceEmptyHint(
  sourceReadError: string | null,
  configuredAtBuild: boolean,
  hasRuntimeFolder: boolean
): string {
  if (sourceReadError) {
    return "Retry after fixing the source configuration, or connect a device folder below.";
  }
  if (configuredAtBuild) {
    return "The bundled content is ready. Connect a device folder to preview and open local files.";
  }
  if (hasRuntimeFolder) return "This folder has no readable Markdown or MDX files yet.";
  return "Choose a folder below, then connect it after reviewing the selection.";
}

export function sourceCountLabel(source: SourceRow): string {
  const unit = source.kind === "rss" ? "feed" : "file";
  return `${source.items.toLocaleString()} ${unit}${source.items === 1 ? "" : "s"}`;
}

export function inspectionSummary(
  inspection: FolderInspection | null,
  summarize: (value: FolderInspection) => InspectionSummary
): InspectionSummary | null {
  return inspection ? summarize(inspection) : null;
}
