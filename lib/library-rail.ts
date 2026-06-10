import type { SourceKind } from "./source-info";

export type LibrarySourceKind = SourceKind | "googledrive";

export type LibrarySourceStatus<Root> =
  | { status: "idle"; root: null; fileCount: 0; error: null }
  | { status: "loading"; root: null; fileCount: 0; error: null }
  | { status: "ready"; root: Root; fileCount: number; error: null }
  | { status: "error"; root: null; fileCount: 0; error: string };

export interface LibrarySourceView<Root> {
  kind: LibrarySourceKind;
  status: LibrarySourceStatus<Root>["status"];
  root: Root | null;
  fileCount: number;
  error: string | null;
  isConnected: boolean;
  open: boolean;
}

interface BuildLibrarySourceViewsOptions<Root> {
  staticKind: SourceKind;
  staticRoot: Root;
  staticFileCount: number;
  runtimeGitHub: LibrarySourceStatus<Root>;
  runtimeLocal: LibrarySourceStatus<Root>;
}

const CLOUD_SOURCE_ORDER: LibrarySourceKind[] = [
  "github",
  "onedrive",
  "googledrive",
];

function sourceOrder(staticKind: SourceKind, includeLocal: boolean): LibrarySourceKind[] {
  const order = [...CLOUD_SOURCE_ORDER];
  if (includeLocal) {
    const insertAt = order.includes(staticKind) ? 1 : 0;
    order.splice(insertAt, 0, "local");
  }
  if (!order.includes(staticKind)) order.unshift(staticKind);
  return order;
}

function runtimeView<Root>(
  kind: SourceKind,
  status: LibrarySourceStatus<Root>,
): LibrarySourceView<Root> | null {
  if (status.status === "idle") return null;
  return {
    kind,
    status: status.status,
    root: status.root,
    fileCount: status.fileCount,
    error: status.error,
    isConnected: status.status === "ready",
    open: status.status === "ready",
  };
}

export function buildLibrarySourceViews<Root>({
  staticKind,
  staticRoot,
  staticFileCount,
  runtimeGitHub,
  runtimeLocal,
}: BuildLibrarySourceViewsOptions<Root>): LibrarySourceView<Root>[] {
  const runtimeViews = new Map<LibrarySourceKind, LibrarySourceView<Root>>();
  const github = runtimeView("github", runtimeGitHub);
  const local = runtimeView("local", runtimeLocal);
  if (github) runtimeViews.set("github", github);
  if (local) runtimeViews.set("local", local);

  const includeLocal =
    staticKind === "local" || runtimeLocal.status !== "idle";

  return sourceOrder(staticKind, includeLocal).map((kind) => {
    const runtime = runtimeViews.get(kind);
    if (runtime) return runtime;

    if (kind === staticKind) {
      return {
        kind,
        status: "ready",
        root: staticRoot,
        fileCount: staticFileCount,
        error: null,
        isConnected: true,
        open: true,
      };
    }

    return {
      kind,
      status: "idle",
      root: null,
      fileCount: 0,
      error: null,
      isConnected: false,
      open: false,
    };
  });
}
