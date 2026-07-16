"use client";

import { Component, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, Download, Save } from "lucide-react";
import { toast } from "sonner";
import EditorDraftContext from "@/components/editor/EditorDraftContext";
import { RuntimeDocument } from "@/components/runtime/RuntimeDocument";
import { isTauri, readLocalFile, writeLocalFile } from "@/lib/tauri";
import { loadActiveLocalFolder } from "@/lib/local-folder";
import { shouldBlockEditorLeave, useEditorLeaveGuard } from "./editor-leave-guard";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "error"; message: string }
  | { kind: "static" };

type SaveStatus = "idle" | "saving" | "saved" | "error";
type EditorTab = "source" | "preview";

const EMPTY_DRAFT_SOURCE = "# Untitled\n\n";
const NATIVE_SAVE_FAILURE_MESSAGE = "Save failed. The draft may not be on disk.";

interface ApiEditorResponse {
  source: string;
  id: string;
  title: string;
  ext: string;
}

type EditorLoadResult =
  | { kind: "ready"; source: string; fileId: string; filename: string }
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
    } catch {
      // Try the next extension.
    }
  }

  return {
    kind: "error",
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
          setFilename(result.filename);
          setLoadState({ kind: "ready" });
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
          setLoadState({ kind: "error", message: String(error) });
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
    filename,
    setFilename,
    loadState,
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
  return (
    <div className="ed-client-bar">
      <div className="ed-client-tabs">
        <button
          type="button"
          className={`ed-ctab${tab === "source" ? " is-active" : ""}`}
          onClick={() => onTabChange("source")}
          aria-pressed={tab === "source"}
        >
          Source
        </button>
        <button
          type="button"
          className={`ed-ctab${tab === "preview" ? " is-active" : ""}`}
          onClick={() => onTabChange("preview")}
          aria-pressed={tab === "preview"}
        >
          Preview
        </button>
      </div>

      {fileId === null && (
        <input
          className="ed-filename-input"
          type="text"
          value={filename}
          onChange={(event) => onFilenameChange(event.target.value)}
          placeholder="filename.mdx"
          aria-label="Filename"
        />
      )}

      <div className="ed-client-actions">
        {saveStatus === "error" && saveError && (
          <span className="ed-save-error" role="alert">
            {saveError}
          </span>
        )}
        {saveStatus === "saved" && (
          <span className="ed-save-success" role="status">
            {isDesktop ? "Saved to local library" : `Downloaded ${filename}`}
          </span>
        )}
        <button type="button" className="v-btn v-btn--sm" onClick={onSave} disabled={!canSave}>
          {isDesktop ? (
            <>
              {saveStatus === "saved" ? <Check aria-hidden /> : <Save aria-hidden />}
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Save"}
            </>
          ) : (
            <>
              {saveStatus === "saved" ? <Check aria-hidden /> : <Download aria-hidden />}
              {saveStatus === "saved" ? "Downloaded" : "Download .mdx"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

interface EditorPaneProps {
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

function EditorPane({ tab, source, onSourceChange, readOnly }: EditorPaneProps) {
  if (tab === "preview") {
    return (
      <div className="ed-preview-pane">
        <EditorPreviewBoundary>
          <RuntimeDocument source={previewMarkdown(source)} />
        </EditorPreviewBoundary>
      </div>
    );
  }

  return (
    <textarea
      className="ed-source-textarea"
      value={source}
      onChange={(event) => onSourceChange(event.target.value)}
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
    filename,
    setFilename,
    loadState,
  } = useEditorDocument(slug);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [tab, setTab] = useState<EditorTab>("source");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desktop = isTauri();
  const shouldBlockLeave = shouldBlockEditorLeave(source, baselineSource, saveStatus);
  useEditorLeaveGuard(shouldBlockLeave);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  async function handleSave() {
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
      await writeLocalFile(root, path, sourceAtSave);
      if (!fileId) setFileId(path);
      setBaselineSource(sourceAtSave);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      setSaveStatus("saved");
      savedTimer.current = setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveStatus("error");
      setSaveError(message);
      toast.error(NATIVE_SAVE_FAILURE_MESSAGE, { description: message });
    }
  }

  if (loadState.kind === "static") return <StaticEditorNotice />;

  const canSave = loadState.kind !== "loading" && saveStatus !== "saving";
  return (
    <div className="ed-client">
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

      <EditorDraftContext isDesktop={desktop} isExistingFile={fileId !== null} />

      {loadState.kind === "loading" && <p className="ed-client-status">Loading…</p>}
      {loadState.kind === "error" && (
        <p className="ed-client-status ed-client-status--warn">{loadState.message}</p>
      )}

      <div className="ed-client-pane">
        <EditorPane
          tab={tab}
          source={source}
          onSourceChange={setSource}
          readOnly={loadState.kind === "loading"}
        />
      </div>
    </div>
  );
}
