"use client";

import { Component, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Download, Save } from "lucide-react";
import { toast } from "sonner";
import { EditorAgentReview } from "@/components/editor/EditorAgentReview";
import EditorDraftContext from "@/components/editor/EditorDraftContext";
import { MdxSourceEditor } from "@/components/editor/MdxSourceEditor";
import workspaceStyles from "@/components/editor/EditorWorkspace.module.css";
import { RuntimeDocument } from "@/components/runtime/RuntimeDocument";
import {
  isLocalFileWriteConflict,
  isTauri,
  readLocalFileVersioned,
  writeLocalFile,
} from "@/lib/tauri";
import { loadActiveLocalFolder } from "@/lib/local-folder";
import { shouldBlockEditorLeave, useEditorLeaveGuard } from "./editor-leave-guard";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "new"; message: string }
  | { kind: "error"; message: string }
  | { kind: "static" };

type SaveStatus = "idle" | "saving" | "saved" | "conflict" | "error";
type EditorTab = "source" | "preview";
type EditorMobilePanel = EditorTab | "agent";

const EMPTY_DRAFT_SOURCE = "# Untitled\n\n";
const NATIVE_SAVE_FAILURE_MESSAGE = "Save failed — draft may not be on disk";

interface ApiEditorResponse {
  source: string;
  id: string;
  title: string;
  ext: string;
}

type EditorLoadResult =
  | { kind: "ready"; source: string; fileId: string; filename: string; revision: string | null }
  | { kind: "new"; message: string; filename: string }
  | { kind: "error"; message: string; filename: string }
  | { kind: "static" };

export interface EditorClientProps {
  slug?: string;
}

function downloadMdx(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function slugFromLocation(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get("slug")?.trim() || undefined;
}

function defaultFilename(slug?: string): string {
  if (!slug) return "untitled.mdx";
  const base = slug.split("/").pop() ?? "untitled";
  return `${base}.mdx`;
}

function previewMarkdown(source: string): string {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function filenameFromPath(path: string, slug: string): string {
  return path.split(/[/\\]/).pop() ?? defaultFilename(slug);
}

function localReadErrorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "object" && error !== null) {
    for (const key of ["message", "error", "reason"] as const) {
      const value = (error as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return String(error);
}

const LOCAL_FILE_NOT_FOUND_CODES = new Set([
  "ENOENT",
  "NOT_FOUND",
  "FILE_NOT_FOUND",
  "PATH_NOT_FOUND",
  "NOTFOUND",
  "NOTFOUNDERROR",
]);
const LOCAL_FILE_NOT_FOUND_MESSAGES = [
  /\bENOENT\b/i,
  /\bos error (?:2|3)\b/i,
  /\bno such file or directory\b/i,
  /\bthe system cannot find the (?:file|path) specified\b/i,
  /^(?:file |path )?not found[.!]?$/i,
];

function isLocalFileNotFoundCode(value: unknown): boolean {
  if (value === 2 || value === 3) return true;
  if (typeof value !== "string") return false;
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return LOCAL_FILE_NOT_FOUND_CODES.has(normalized);
}

function isExplicitLocalFileNotFound(error: unknown, seen = new Set<unknown>()): boolean {
  if (typeof error === "object" && error !== null) {
    if (seen.has(error)) return false;
    seen.add(error);
    const record = error as Record<string, unknown>;
    const discriminators = [record.code, record.kind, record.name];
    if (discriminators.some(isLocalFileNotFoundCode)) return true;
    const nestedErrors = [record.cause, record.error].filter(
      (value): value is object => typeof value === "object" && value !== null
    );
    if (nestedErrors.some((nested) => isExplicitLocalFileNotFound(nested, seen))) {
      return true;
    }
  }

  const message = localReadErrorMessage(error);
  return LOCAL_FILE_NOT_FOUND_MESSAGES.some((pattern) => pattern.test(message));
}

async function loadDesktopDocument(slug: string): Promise<EditorLoadResult> {
  const folder = loadActiveLocalFolder();
  if (!folder) {
    return {
      kind: "error",
      message: "No active folder selected. Use Connect Source first.",
      filename: defaultFilename(slug),
    };
  }

  const candidates = [`${folder}/${slug}.mdx`, `${folder}/${slug}.md`];
  for (const path of candidates) {
    try {
      const document = await readLocalFileVersioned(folder, path);
      return {
        kind: "ready",
        source: document.source,
        fileId: path,
        filename: filenameFromPath(path, slug),
        revision: document.revision,
      };
    } catch (error: unknown) {
      if (isExplicitLocalFileNotFound(error)) continue;
      const filename = filenameFromPath(path, slug);
      return {
        kind: "error",
        message: `Could not open "${filename}": ${localReadErrorMessage(error)} — editing and saving are disabled to keep the file unchanged.`,
        filename,
      };
    }
  }

  return {
    kind: "new",
    message: `"${slug}" not found in ${folder}. Editing a new file.`,
    filename: defaultFilename(slug),
  };
}

async function loadWebDocument(slug: string): Promise<EditorLoadResult> {
  try {
    const response = await fetch(`/api/editor?slug=${encodeURIComponent(slug)}`);
    if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
      return { kind: "static" };
    }

    const json = (await response.json()) as { error?: string } & Partial<ApiEditorResponse>;
    if (response.status === 404) {
      return {
        kind: "new",
        message: `"${slug}" was not found. Editing a new browser draft.`,
        filename: defaultFilename(slug),
      };
    }
    if (!response.ok || json.error) {
      return {
        kind: "error",
        message: json.error ?? `Error ${response.status}`,
        filename: defaultFilename(slug),
      };
    }

    if (json.source === undefined || json.id === undefined || json.ext === undefined) {
      return {
        kind: "error",
        message: "Unexpected API response.",
        filename: defaultFilename(slug),
      };
    }

    return {
      kind: "ready",
      source: json.source,
      fileId: json.id,
      filename: `${slug.split("/").pop() ?? "untitled"}${json.ext}`,
      revision: null,
    };
  } catch {
    return { kind: "static" };
  }
}

function loadEditorDocument(slug: string): Promise<EditorLoadResult> {
  return isTauri() ? loadDesktopDocument(slug) : loadWebDocument(slug);
}

function localSavePath(fileId: string | null, filename: string): string | null {
  if (fileId) return fileId;
  const folder = loadActiveLocalFolder();
  return folder ? `${folder}/${filename}` : null;
}

function useEditorDocument(slug?: string) {
  const [routeSlug, setRouteSlug] = useState<string | undefined>(undefined);
  const activeSlug = slug ?? routeSlug;
  const [source, setSource] = useState(EMPTY_DRAFT_SOURCE);
  const [baselineSource, setBaselineSource] = useState(EMPTY_DRAFT_SOURCE);
  const [fileId, setFileId] = useState<string | null>(null);
  const [diskRevision, setDiskRevision] = useState<string | null>(null);
  const [filename, setFilename] = useState(() => defaultFilename(activeSlug));
  const [loadState, setLoadState] = useState<LoadState>(
    activeSlug ? { kind: "loading" } : { kind: "ready" }
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setRouteSlug(slug ? undefined : slugFromLocation());
    });
    return () => cancelAnimationFrame(frame);
  }, [slug]);

  useEffect(() => {
    if (!activeSlug) return;

    const currentSlug = activeSlug;
    let cancelled = false;
    const loadingFrame = requestAnimationFrame(() => {
      if (!cancelled) setLoadState({ kind: "loading" });
    });

    async function load() {
      try {
        const result = await loadEditorDocument(currentSlug);
        cancelAnimationFrame(loadingFrame);
        if (cancelled) return;

        if (result.kind === "ready") {
          setSource(result.source);
          setBaselineSource(result.source);
          setFileId(result.fileId);
          setDiskRevision(result.revision);
          setFilename(result.filename);
          setLoadState({ kind: "ready" });
        } else if (result.kind === "new") {
          setSource(EMPTY_DRAFT_SOURCE);
          setBaselineSource(EMPTY_DRAFT_SOURCE);
          setFileId(null);
          setDiskRevision(null);
          setFilename(result.filename);
          setLoadState({ kind: "new", message: result.message });
        } else if (result.kind === "error") {
          setSource("");
          setBaselineSource("");
          setFileId(null);
          setDiskRevision(null);
          setFilename(result.filename);
          setLoadState({ kind: "error", message: result.message });
        } else {
          setLoadState({ kind: "static" });
        }
      } catch (error: unknown) {
        cancelAnimationFrame(loadingFrame);
        if (!cancelled) {
          setSource("");
          setBaselineSource("");
          setFileId(null);
          setDiskRevision(null);
          setLoadState({ kind: "error", message: localReadErrorMessage(error) });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      cancelAnimationFrame(loadingFrame);
    };
  }, [activeSlug]);

  return {
    source,
    setSource,
    baselineSource,
    setBaselineSource,
    fileId,
    setFileId,
    diskRevision,
    setDiskRevision,
    filename,
    setFilename,
    loadState,
  };
}

interface EditorToolbarProps {
  tab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  mobilePanel: EditorMobilePanel;
  onMobilePanelChange: (panel: EditorMobilePanel) => void;
  fileId: string | null;
  filename: string;
  onFilenameChange: (filename: string) => void;
  isDesktop: boolean;
  saveStatus: SaveStatus;
  saveError: string;
  canEdit: boolean;
  canSave: boolean;
  onSave: () => void;
  onReloadConflict: () => void;
  onOverwriteConflict: () => void;
}

function EditorToolbar({
  tab,
  onTabChange,
  mobilePanel,
  onMobilePanelChange,
  fileId,
  filename,
  onFilenameChange,
  isDesktop,
  saveStatus,
  saveError,
  canEdit,
  canSave,
  onSave,
  onReloadConflict,
  onOverwriteConflict,
}: EditorToolbarProps) {
  const sourceButton = (mobile: boolean) => (
    <button
      type="button"
      className={`ed-ctab${(mobile ? mobilePanel === "source" : tab === "source") ? " is-active" : ""}`}
      onClick={() => (mobile ? onMobilePanelChange("source") : onTabChange("source"))}
      aria-controls="editor-document-panel"
      aria-pressed={mobile ? mobilePanel === "source" : tab === "source"}
    >
      Source
    </button>
  );
  const previewButton = (mobile: boolean) => (
    <button
      type="button"
      className={`ed-ctab${(mobile ? mobilePanel === "preview" : tab === "preview") ? " is-active" : ""}`}
      onClick={() => (mobile ? onMobilePanelChange("preview") : onTabChange("preview"))}
      aria-controls="editor-document-panel"
      aria-pressed={mobile ? mobilePanel === "preview" : tab === "preview"}
    >
      Preview
    </button>
  );

  return (
    <div className="ed-client-bar">
      <div
        className="ed-client-tabs ed-client-tabs--desktop"
        role="group"
        aria-label="Document view"
      >
        {sourceButton(false)}
        {previewButton(false)}
      </div>
      <div className="ed-client-tabs ed-client-tabs--mobile" role="group" aria-label="Editor panel">
        {sourceButton(true)}
        {previewButton(true)}
        <button
          type="button"
          className={`ed-ctab${mobilePanel === "agent" ? " is-active" : ""}`}
          onClick={() => onMobilePanelChange("agent")}
          aria-controls="editor-agent-panel"
          aria-pressed={mobilePanel === "agent"}
        >
          Agent
        </button>
      </div>

      <div className="ed-document-meta">
        {fileId === null && (
          <input
            className="ed-filename-input"
            type="text"
            value={filename}
            onChange={(event) => onFilenameChange(event.target.value)}
            placeholder="filename.mdx"
            aria-label="Filename"
            disabled={!canEdit}
          />
        )}
        {fileId !== null && (
          <span className="ed-filename-label" title={filename}>
            {filename}
          </span>
        )}
        {canEdit && <EditorDraftContext isDesktop={isDesktop} isExistingFile={fileId !== null} />}
      </div>

      <div className="ed-client-actions">
        {(saveStatus === "error" || saveStatus === "conflict") && saveError && (
          <span className="ed-save-error" role="alert">
            {saveError}
          </span>
        )}
        {saveStatus === "conflict" ? (
          <>
            <button
              type="button"
              className="v-btn v-btn--sm"
              onClick={onReloadConflict}
              disabled={!canSave}
            >
              Reload disk version
            </button>
            <button
              type="button"
              className="v-btn v-btn--sm"
              onClick={onOverwriteConflict}
              disabled={!canSave}
            >
              Overwrite anyway
            </button>
          </>
        ) : null}
        {saveStatus === "saved" && (
          <span className="ed-save-success" role="status">
            {isDesktop ? "Saved to local library" : `Downloaded ${filename}`}
          </span>
        )}
        <button type="button" className="v-btn v-btn--sm" onClick={onSave} disabled={!canSave}>
          {isDesktop ? (
            <>
              <Save aria-hidden />
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : "Save"}
            </>
          ) : (
            <>
              <Download aria-hidden />
              {saveStatus === "saved" ? "Downloaded ✓" : "Download .mdx"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

interface EditorPaneProps {
  format: "md" | "mdx";
  tab: EditorTab;
  source: string;
  onSourceChange: (source: string) => void;
  readOnly: boolean;
}

class EditorPreviewBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ed-preview-error" role="alert">
          <strong>Preview unavailable</strong>
          <p>Fix the MDX syntax in Source, then open Preview again.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

function EditorPane({ format, tab, source, onSourceChange, readOnly }: EditorPaneProps) {
  if (tab === "preview") {
    return (
      <div className={`ed-preview-pane ${workspaceStyles.previewSurface}`}>
        <EditorPreviewBoundary>
          <RuntimeDocument source={previewMarkdown(source)} format={format} />
        </EditorPreviewBoundary>
      </div>
    );
  }

  return (
    <MdxSourceEditor
      className={workspaceStyles.sourceSurface}
      textareaClassName="ed-source-textarea"
      value={source}
      format={format}
      onValueChange={onSourceChange}
      spellCheck={false}
      aria-label="MDX source"
      readOnly={readOnly}
    />
  );
}

function StaticEditorNotice() {
  return (
    <div className="ed-static-notice">
      <p>The editor requires the development server or the Verto desktop app.</p>
      <p>
        Run <code>npm run dev</code> locally, or open Verto as a desktop app to edit files.
      </p>
    </div>
  );
}

export default function EditorClient({ slug }: EditorClientProps) {
  const {
    source,
    setSource,
    baselineSource,
    setBaselineSource,
    fileId,
    setFileId,
    diskRevision,
    setDiskRevision,
    filename,
    setFilename,
    loadState,
  } = useEditorDocument(slug);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [tab, setTab] = useState<EditorTab>("source");
  const [mobilePanel, setMobilePanel] = useState<EditorMobilePanel>("source");
  const [draftRevision, setDraftRevision] = useState(0);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desktop = isTauri();
  const editingBlocked = loadState.kind === "loading" || loadState.kind === "error";
  const shouldBlockLeave = shouldBlockEditorLeave(source, baselineSource, saveStatus);
  useEditorLeaveGuard(shouldBlockLeave);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  function handleDraftChange(nextSource: string) {
    if (editingBlocked) return;
    setSource(nextSource);
    setDraftRevision((current) => current + 1);
    if (saveStatus === "saved") {
      if (savedTimer.current) clearTimeout(savedTimer.current);
      setSaveStatus("idle");
    }
  }

  function handleFilenameChange(nextFilename: string) {
    if (editingBlocked) return;
    setFilename(nextFilename);
    setDraftRevision((current) => current + 1);
    if (saveStatus === "saved") {
      if (savedTimer.current) clearTimeout(savedTimer.current);
      setSaveStatus("idle");
    }
  }

  function handleTabChange(nextTab: EditorTab) {
    setTab(nextTab);
    setMobilePanel(nextTab);
  }

  function handleMobilePanelChange(nextPanel: EditorMobilePanel) {
    setMobilePanel(nextPanel);
    if (nextPanel !== "agent") setTab(nextPanel);
  }

  async function handleSave(forceOverwrite = false) {
    if (editingBlocked) return;
    setSaveStatus("saving");
    setSaveError("");
    const sourceAtSave = source;

    if (!desktop) {
      try {
        downloadMdx(filename, sourceAtSave);
        setBaselineSource(sourceAtSave);
        if (savedTimer.current) clearTimeout(savedTimer.current);
        setSaveStatus("saved");
        savedTimer.current = setTimeout(() => setSaveStatus("idle"), 2500);
      } catch (error: unknown) {
        setSaveStatus("error");
        setSaveError(error instanceof Error ? error.message : String(error));
      }
      return;
    }

    const path = localSavePath(fileId, filename);
    if (!path) {
      setSaveStatus("error");
      const message = "No active folder. Use Connect Source to select a folder first.";
      setSaveError(message);
      toast.error(NATIVE_SAVE_FAILURE_MESSAGE, { description: message });
      return;
    }

    try {
      const root = loadActiveLocalFolder();
      if (!root) throw new Error("No active local library is selected.");
      const receipt = await writeLocalFile(root, path, sourceAtSave, {
        expectedRevision: fileId ? diskRevision : null,
        force: forceOverwrite,
      });
      if (!fileId) setFileId(path);
      setDiskRevision(receipt.revision);
      setBaselineSource(sourceAtSave);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      setSaveStatus("saved");
      savedTimer.current = setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveStatus(isLocalFileWriteConflict(error) ? "conflict" : "error");
      setSaveError(message);
      toast.error(NATIVE_SAVE_FAILURE_MESSAGE, { description: message });
    }
  }

  async function handleReloadConflict() {
    const root = loadActiveLocalFolder();
    if (!desktop || !root || !fileId) return;
    setSaveStatus("saving");
    setSaveError("");
    try {
      const document = await readLocalFileVersioned(root, fileId);
      setSource(document.source);
      setBaselineSource(document.source);
      setDiskRevision(document.revision);
      setDraftRevision((current) => current + 1);
      setSaveStatus("idle");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveStatus("error");
      setSaveError(message);
      toast.error(NATIVE_SAVE_FAILURE_MESSAGE, { description: message });
    }
  }

  if (loadState.kind === "static") return <StaticEditorNotice />;

  const canSave = !editingBlocked && saveStatus !== "saving";
  return (
    <div className="ed-client">
      <EditorToolbar
        tab={tab}
        onTabChange={handleTabChange}
        mobilePanel={mobilePanel}
        onMobilePanelChange={handleMobilePanelChange}
        fileId={fileId}
        filename={filename}
        onFilenameChange={handleFilenameChange}
        isDesktop={desktop}
        saveStatus={saveStatus}
        saveError={saveError}
        canEdit={!editingBlocked}
        canSave={canSave}
        onSave={() => void handleSave()}
        onReloadConflict={() => void handleReloadConflict()}
        onOverwriteConflict={() => void handleSave(true)}
      />

      {loadState.kind === "loading" && <p className="ed-client-status">Loading…</p>}
      {loadState.kind === "error" && (
        <p className="ed-client-status ed-client-status--warn">{loadState.message}</p>
      )}
      {loadState.kind === "new" && <p className="ed-client-status">{loadState.message}</p>}

      <div className={workspaceStyles.workspace} data-mobile-panel={mobilePanel}>
        <div
          className={workspaceStyles.documentPane}
          id="editor-document-panel"
          onFocusCapture={() => setMobilePanel(tab)}
        >
          <div className="ed-client-pane">
            <EditorPane
              format={editorFormat(filename)}
              tab={tab}
              source={source}
              onSourceChange={handleDraftChange}
              readOnly={editingBlocked}
            />
          </div>
        </div>
        <div
          className={workspaceStyles.agentPane}
          id="editor-agent-panel"
          onFocusCapture={() => setMobilePanel("agent")}
        >
          <EditorAgentReview
            source={source}
            format={editorFormat(filename)}
            filename={filename}
            revision={draftRevision}
            onApply={handleDraftChange}
            disabled={editingBlocked}
            persistenceMode={desktop ? "disk" : "download"}
          />
        </div>
      </div>
    </div>
  );
}

function editorFormat(filename: string): "md" | "mdx" {
  return filename.toLowerCase().endsWith(".md") ? "md" : "mdx";
}
