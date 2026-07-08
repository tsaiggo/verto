import type { SourceKind } from "./source-info";

export type LibrarySourceKind = "local";

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
  runtimeLocal: LibrarySourceStatus<Root>;
}

function idleLocalView<Root>(): LibrarySourceView<Root> {
  return {
    kind: "local",
    status: "idle",
    root: null,
    fileCount: 0,
    error: null,
    isConnected: false,
    open: false,
  };
}

function runtimeLocalView<Root>(status: LibrarySourceStatus<Root>): LibrarySourceView<Root> | null {
  if (status.status === "idle") return null;
  return {
    kind: "local",
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
  runtimeLocal,
}: BuildLibrarySourceViewsOptions<Root>): LibrarySourceView<Root>[] {
  const runtime = runtimeLocalView(runtimeLocal);
  if (runtime) return [runtime];

  if (staticKind === "local") {
    return [
      {
        kind: "local",
        status: "ready",
        root: staticRoot,
        fileCount: staticFileCount,
        error: null,
        isConnected: true,
        open: true,
      },
    ];
  }

  return [idleLocalView()];
}
