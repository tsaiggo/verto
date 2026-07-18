"use client";

import { Component, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, Download, Save } from "lucide-react";
import { toast } from "sonner";
import EditorDraftContext from "@/components/editor/EditorDraftContext";
import ContentTabs, { contentTabId } from "@/components/layout/ContentTabs";
import { RuntimeDocument } from "@/components/runtime/RuntimeDocument";
import { Button } from "@/components/ui/button";
import {
  ContentEmptyState,
  ContentStatus,
  ContentToolbar,
} from "@/components/ui/content-primitives";
import { isTauri, readLocalFile, writeLocalFile } from "@/lib/tauri";
import { loadActiveLocalFolder } from "@/lib/local-folder";
import { APP_NEW_DOCUMENT_EVENT } from "@/lib/app-navigation";
import { shouldBlockEditorLeave, useEditorLeaveGuard } from "./editor-leave-guard";
import styles from "./EditorClient.module.css";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "missing"; message: string }
  | { kind: "error"; message: string }
  | { kind: "static" };

type SaveStatus = "idle" | "saving" | "saved" | "error";
type EditorTab = "source" | "preview";

const EMPTY_DRAFT_SOURCE = "# Untitled\n\n";
const NATIVE_SAVE_FAILURE_MESSAGE = "Save failed. The draft may not be on disk.";
const EDITOR_TABS_ID = "editor-view-tabs";
const EDITOR_SOURCE_PANEL_ID = "editor-source-panel";
const EDITOR_PREVIEW_PANEL_ID = "editor-preview-panel";
const EDITOR_TABS = [
  { id: "source" as const, label: "Source", panelId: EDITOR_SOURCE_PANEL_ID },
  { id: "preview" as const, label: "Preview", panelId: EDITOR_PREVIEW_PANEL_ID },
];
const WINDOWS_RESERVED_FILENAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const LOCAL_NOT_FOUND_PREFIX = /^(?:could not inspect file|could not resolve file):/i;
const LOCAL_NOT_FOUND_OS_ERROR = /\(os error (?:2|3)\)\s*$/i;
const EDITOR_CAPABILITY_HEADER = "x-verto-editor-capability";

interface ApiEditorResponse {
  source: string;
  id: string;
  title: string;
  ext: string;
}

type EditorLoadResult =
  | { kind: "ready"; source: string; fileId: string; filename: string }
  | { kind: "missing"; message: string; filename: string }
  | { kind: "error"; message: string; filename: string }
  | { kind: "static" };

export interface EditorClientProps {
  slug?: string;
}

export function editorFilenameError(filename: string): string | null {
  const value = filename.trim();
  if (!value) return "Enter a filename.";
  if (value !== filename) return "Remove leading or trailing spaces.";
  if (value.length > 255) return "Keep the filename under 256 characters.";
  if (/[<>:\"/\\|?*\u0000-\u001f]/.test(value)) return "Use a filename without path characters.";
  if (/[. ]$/.test(value)) return "The filename cannot end with a period or space.";
  if (WINDOWS_RESERVED_FILENAME.test(value)) return "Choose a different filename.";
  if (!/\.(?:md|mdx)$/i.test(value)) return "Use a .md or .mdx filename.";
  return null;
}

export function editorErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return "Unknown file error.";
}

/**
 * The current Tauri command returns Result<_, String>, not a structured
 * error. Trust only its exact path-inspection prefix plus the platform's
 * stable not-found OS codes. Every unfamiliar error fails closed so a read
 * failure can never turn into an overwrite-capable blank draft.
 */
export function isMissingLocalFileError(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { code?: unknown; kind?: unknown };
    const code = candidate.code ?? candidate.kind;
    if (typeof code === "string" && code.toLowerCase() === "not_found") return true;
  }

  const message = editorErrorMessage(error);
  return LOCAL_NOT_FOUND_PREFIX.test(message) && LOCAL_NOT_FOUND_OS_ERROR.test(message);
}

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.includes("application/json") || /\+json(?:;|$)/.test(contentType);
}

function editorCapabilityUnavailable(response: Response): boolean {
  const capability = response.headers.get(EDITOR_CAPABILITY_HEADER)?.trim().toLowerCase();
  return capability === "unavailable" || capability === "static";
}

function isApiEditorResponse(value: Partial<ApiEditorResponse>): value is ApiEditorResponse {
  return (
    typeof value.source === "string" &&
    typeof value.id === "string" &&
    (value.ext === ".md" || value.ext === ".mdx")
  );
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
      return {
        kind: "ready",
        source: await readLocalFile(folder, path),
        fileId: path,
        filename: filenameFromPath(path, slug),
      };
    } catch (error: unknown) {
      if (isMissingLocalFileError(error)) continue;
      return {
        kind: "error",
        message: `Could not read ${path}. ${editorErrorMessage(error)}`,
        filename: defaultFilename(slug),
      };
    }
  }

  return {
    kind: "missing",
    message: `"${slug}" was not found in ${folder}. Use this blank draft to create ${defaultFilename(slug)}.`,
    filename: defaultFilename(slug),
  };
}

async function loadWebDocument(slug: string): Promise<EditorLoadResult> {
  let response: Response;
  try {
    response = await fetch(`/api/editor?slug=${encodeURIComponent(slug)}`);
  } catch {
    return {
      kind: "error",
      message: "The Editor API could not be reached. Check your connection and try again.",
      filename: defaultFilename(slug),
    };
  }

  if (editorCapabilityUnavailable(response)) return { kind: "static" };

  const jsonResponse = isJsonResponse(response);
  // A static export has no Pages API route and normally returns its HTML 404.
  // A JSON 404 is the live API's explicit document-missing response instead.
  if (response.status === 404 && !jsonResponse) return { kind: "static" };
  if (!jsonResponse) {
    return {
      kind: "error",
      message: `The Editor API returned a non-JSON response (HTTP ${response.status}). Try again.`,
      filename: defaultFilename(slug),
    };
  }

  let json: { error?: string } & Partial<ApiEditorResponse>;
  try {
    json = (await response.json()) as { error?: string } & Partial<ApiEditorResponse>;
  } catch {
    return {
      kind: "error",
      message: "The Editor API returned invalid JSON. Try again.",
      filename: defaultFilename(slug),
    };
  }

  if (response.status === 404) {
    return {
      kind: "missing",
      message: `"${slug}" was not found. Use this blank draft to create ${defaultFilename(slug)}.`,
      filename: defaultFilename(slug),
    };
  }
  if (!response.ok || json.error) {
    return {
      kind: "error",
      message:
        json.error ?? `The Editor API request failed with status ${response.status}. Try again.`,
      filename: defaultFilename(slug),
    };
  }

  if (!isApiEditorResponse(json)) {
    return {
      kind: "error",
      message: "The Editor API returned an unexpected document payload. Try again.",
      filename: defaultFilename(slug),
    };
  }

  return {
    kind: "ready",
    source: json.source,
    fileId: json.id,
    filename: `${slug.split("/").pop() ?? "untitled"}${json.ext}`,
  };
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
  const [filename, setFilename] = useState(() => defaultFilename(activeSlug));
  const [loadState, setLoadState] = useState<LoadState>(
    activeSlug ? { kind: "loading" } : { kind: "ready" }
  );
  const [loadAttempt, setLoadAttempt] = useState(0);

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
          setFilename(result.filename);
          setLoadState({ kind: "ready" });
        } else if (result.kind === "missing") {
          setSource(EMPTY_DRAFT_SOURCE);
          setBaselineSource(EMPTY_DRAFT_SOURCE);
          setFileId(null);
          setFilename(result.filename);
          setLoadState({ kind: "missing", message: result.message });
        } else if (result.kind === "error") {
          setSource(EMPTY_DRAFT_SOURCE);
          setBaselineSource(EMPTY_DRAFT_SOURCE);
          setFileId(null);
          setFilename(result.filename);
          setLoadState({ kind: "error", message: result.message });
        } else {
          setLoadState({ kind: "static" });
        }
      } catch (error: unknown) {
        cancelAnimationFrame(loadingFrame);
        if (!cancelled) {
          setSource(EMPTY_DRAFT_SOURCE);
          setBaselineSource(EMPTY_DRAFT_SOURCE);
          setFileId(null);
          setFilename(defaultFilename(currentSlug));
          setLoadState({ kind: "error", message: editorErrorMessage(error) });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      cancelAnimationFrame(loadingFrame);
    };
  }, [activeSlug, loadAttempt]);

  const retryDocument = useCallback(() => {
    if (!activeSlug) return;
    setLoadState({ kind: "loading" });
    setLoadAttempt((attempt) => attempt + 1);
  }, [activeSlug]);

  const resetDocument = useCallback(() => {
    setRouteSlug(undefined);
    setSource(EMPTY_DRAFT_SOURCE);
    setBaselineSource(EMPTY_DRAFT_SOURCE);
    setFileId(null);
    setFilename(defaultFilename(undefined));
    setLoadState({ kind: "ready" });
    if (
      window.location.pathname === "/editor" &&
      (window.location.search || window.location.hash)
    ) {
      window.history.replaceState(window.history.state, "", "/editor");
    }
  }, []);

  return {
    source,
    setSource,
    baselineSource,
    setBaselineSource,
    fileId,
    setFileId,
    filename,
    setFilename,
    loadState,
    retryDocument,
    resetDocument,
  };
}

interface EditorToolbarProps {
  tab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  fileId: string | null;
  filename: string;
  onFilenameChange: (filename: string) => void;
  isDesktop: boolean;
  saveStatus: SaveStatus;
  saveError: string;
  canSave: boolean;
  onSave: () => void;
}

function EditorToolbar({
  tab,
  onTabChange,
  fileId,
  filename,
  onFilenameChange,
  isDesktop,
  saveStatus,
  saveError,
  canSave,
  onSave,
}: EditorToolbarProps) {
  const filenameError = fileId === null ? editorFilenameError(filename) : null;
  return (
    <ContentToolbar className={`${styles.toolbar} ed-client-bar`}>
      <ContentTabs
        id={EDITOR_TABS_ID}
        className={`${styles.tabs} ed-client-tabs`}
        items={EDITOR_TABS}
        value={tab}
        onValueChange={onTabChange}
        label="Editor view"
      />

      {fileId === null && (
        <div className={styles.filenameField}>
          <input
            className={`${styles.filenameInput} ed-filename-input`}
            type="text"
            value={filename}
            onChange={(event) => onFilenameChange(event.target.value)}
            placeholder="filename.mdx"
            aria-label="Filename"
            aria-invalid={filenameError ? true : undefined}
            aria-describedby={filenameError ? "editor-filename-error" : undefined}
          />
          {filenameError ? (
            <span id="editor-filename-error" className={styles.filenameError} role="alert">
              {filenameError}
            </span>
          ) : null}
        </div>
      )}

      <div className={`${styles.actions} ed-client-actions`}>
        {saveStatus === "error" && saveError && (
          <span className={styles.saveError} role="alert">
            {saveError}
          </span>
        )}
        {saveStatus === "saved" && (
          <span className={styles.saveSuccess} role="status">
            {isDesktop ? "Saved to local library" : `Downloaded ${filename}`}
          </span>
        )}
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={!canSave || !!filenameError}
          aria-label={
            isDesktop
              ? undefined
              : `Download ${filename.toLowerCase().endsWith(".md") ? ".md" : ".mdx"}`
          }
        >
          {isDesktop ? (
            <>
              {saveStatus === "saved" ? <Check aria-hidden /> : <Save aria-hidden />}
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Save"}
            </>
          ) : (
            <>
              {saveStatus === "saved" ? <Check aria-hidden /> : <Download aria-hidden />}
              {saveStatus === "saved" ? "Downloaded" : "Download"}
            </>
          )}
        </Button>
      </div>
    </ContentToolbar>
  );
}

interface EditorPaneProps {
  tab: EditorTab;
  source: string;
  filename: string;
  onSourceChange: (source: string) => void;
  readOnly: boolean;
  notice?: ReactNode;
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

function EditorPane({ tab, source, filename, onSourceChange, readOnly, notice }: EditorPaneProps) {
  return (
    <>
      <section
        className={styles.tabPanel}
        id={EDITOR_SOURCE_PANEL_ID}
        role="tabpanel"
        aria-labelledby={contentTabId(EDITOR_TABS_ID, "source")}
        hidden={tab !== "source"}
        tabIndex={tab === "source" ? 0 : -1}
      >
        {tab === "source" ? notice : null}
        <textarea
          className={`${styles.source} ed-source-textarea`}
          value={source}
          onChange={(event) => onSourceChange(event.target.value)}
          spellCheck={false}
          aria-label="MDX source"
          readOnly={readOnly}
        />
      </section>

      <section
        className={styles.tabPanel}
        id={EDITOR_PREVIEW_PANEL_ID}
        role="tabpanel"
        aria-labelledby={contentTabId(EDITOR_TABS_ID, "preview")}
        hidden={tab !== "preview"}
        tabIndex={tab === "preview" ? 0 : -1}
      >
        {tab === "preview" ? (
          <>
            {notice}
            <div className={`${styles.previewScroller} ed-preview-pane`}>
              <article className={`${styles.previewArticle} content-wrap prose`}>
                <EditorPreviewBoundary>
                  <RuntimeDocument
                    source={previewMarkdown(source)}
                    format={filename.toLowerCase().endsWith(".md") ? "md" : "mdx"}
                  />
                </EditorPreviewBoundary>
              </article>
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}

function EditorRouteNotice({ loadState, onRetry }: { loadState: LoadState; onRetry: () => void }) {
  if (loadState.kind === "loading") {
    return (
      <ContentStatus className={styles.routeStatus} status="loading" title="Loading document" />
    );
  }
  if (loadState.kind === "missing") {
    return (
      <ContentStatus
        className={styles.routeStatus}
        title="The requested file was not found"
        description={loadState.message}
      />
    );
  }
  if (loadState.kind === "error") {
    return (
      <ContentStatus
        className={styles.routeStatus}
        status="error"
        title="The requested file could not be opened"
        description={loadState.message}
        action={
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        }
      />
    );
  }
  return null;
}

function StaticEditorNotice() {
  return (
    <ContentEmptyState
      compact
      title="Editor unavailable in this build"
      description="Open Verto Desktop or run the development server locally to edit files."
    />
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
    filename,
    setFilename,
    loadState,
    retryDocument,
    resetDocument,
  } = useEditorDocument(slug);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [tab, setTab] = useState<EditorTab>("source");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRequest = useRef(0);
  const desktop = isTauri();
  const shouldBlockLeave = shouldBlockEditorLeave(source, baselineSource, saveStatus);
  useEditorLeaveGuard(shouldBlockLeave);

  useEffect(() => {
    const startNewDocument = () => {
      if (
        shouldBlockLeave &&
        !window.confirm("Discard your unsaved changes and start a new document?")
      ) {
        return;
      }
      saveRequest.current += 1;
      if (savedTimer.current) {
        clearTimeout(savedTimer.current);
        savedTimer.current = null;
      }
      resetDocument();
      setSaveStatus("idle");
      setSaveError("");
      setTab("source");
    };
    window.addEventListener(APP_NEW_DOCUMENT_EVENT, startNewDocument);
    return () => window.removeEventListener(APP_NEW_DOCUMENT_EVENT, startNewDocument);
  }, [resetDocument, shouldBlockLeave]);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  async function handleSave() {
    const request = ++saveRequest.current;
    const isCurrentRequest = () => saveRequest.current === request;
    setSaveStatus("saving");
    setSaveError("");
    const sourceAtSave = source;

    if (!desktop) {
      try {
        downloadMdx(filename, sourceAtSave);
        if (!isCurrentRequest()) return;
        setBaselineSource(sourceAtSave);
        if (savedTimer.current) clearTimeout(savedTimer.current);
        setSaveStatus("saved");
        savedTimer.current = setTimeout(() => {
          if (isCurrentRequest()) setSaveStatus("idle");
        }, 2500);
      } catch (error: unknown) {
        if (!isCurrentRequest()) return;
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
      await writeLocalFile(root, path, sourceAtSave);
      if (!isCurrentRequest()) return;
      if (!fileId) setFileId(path);
      setBaselineSource(sourceAtSave);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      setSaveStatus("saved");
      savedTimer.current = setTimeout(() => {
        if (isCurrentRequest()) setSaveStatus("idle");
      }, 2500);
    } catch (error: unknown) {
      if (!isCurrentRequest()) return;
      const message = error instanceof Error ? error.message : String(error);
      setSaveStatus("error");
      setSaveError(message);
      toast.error(NATIVE_SAVE_FAILURE_MESSAGE, { description: message });
    }
  }

  if (loadState.kind === "static") return <StaticEditorNotice />;

  const filenameError = fileId === null ? editorFilenameError(filename) : null;
  const canSave =
    (loadState.kind === "ready" || loadState.kind === "missing") &&
    saveStatus !== "saving" &&
    filenameError === null;
  const routeNotice = <EditorRouteNotice loadState={loadState} onRetry={retryDocument} />;
  return (
    <div className={`${styles.editor} ed-client`}>
      <EditorToolbar
        tab={tab}
        onTabChange={setTab}
        fileId={fileId}
        filename={filename}
        onFilenameChange={setFilename}
        isDesktop={desktop}
        saveStatus={saveStatus}
        saveError={saveError}
        canSave={canSave}
        onSave={() => void handleSave()}
      />

      <div className={styles.context}>
        <EditorDraftContext isDesktop={desktop} isExistingFile={fileId !== null} />
      </div>

      <div className={`${styles.pane} ed-client-pane`}>
        <EditorPane
          tab={tab}
          source={source}
          filename={filename}
          onSourceChange={setSource}
          readOnly={loadState.kind === "loading" || loadState.kind === "error"}
          notice={routeNotice}
        />
      </div>
    </div>
  );
}
