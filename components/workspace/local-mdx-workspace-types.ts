import type { RuntimeDocumentFormat } from "@/components/runtime/RuntimeDocument";

export type LocalMdxWorkspaceMode = "read" | "edit" | "split";
export type LocalMdxWorkspacePane = "source" | "preview";
export type LocalMdxWorkspaceFormat = RuntimeDocumentFormat;

export interface LocalMdxWorkspaceSavePayload {
  source: string;
  title: string;
  fileId: string | null;
  format: LocalMdxWorkspaceFormat;
  isDesktop: boolean;
  /** Set only by the explicit conflict-recovery control. */
  forceOverwrite?: boolean;
}

export interface LocalMdxWorkspaceProps {
  /** The persisted document text. A new source or fileId starts a new editing session. */
  source: string;
  title: string;
  /** Opaque local-file identifier. Use null for a newly created draft. */
  fileId?: string | null;
  format?: LocalMdxWorkspaceFormat;
  /** Receives the current draft when the user saves, including Cmd/Ctrl+S. */
  onSave?: (payload: LocalMdxWorkspaceSavePayload) => void | Promise<void>;
  /**
   * Read the latest persisted text after a revision conflict. The workspace
   * replaces its local draft only after this promise resolves successfully.
   */
  onReloadFromDisk?: () => string | Promise<string>;
  /** Reports draft changes. Keep `source` as the persisted baseline, rather than echoing each edit. */
  onSourceChange?: (source: string) => void;
  /** Controls copy only; the workspace never performs filesystem operations itself. */
  isDesktop?: boolean;
  /** `document` removes the outer card treatment for a plain embedded canvas. */
  appearance?: "panel" | "document";
  initialMode?: LocalMdxWorkspaceMode;
  className?: string;
}

export type LocalMdxWorkspaceSaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };
