"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Check, Code2, Eye, FileText, Save } from "lucide-react";

import { cn } from "@/lib/utils";

import { PreviewPane, SourcePane } from "./LocalMdxWorkspacePreview";
import { ModeControl, PaneControl, SaveNotice } from "./LocalMdxWorkspaceControls";
import type {
  LocalMdxWorkspaceMode,
  LocalMdxWorkspacePane,
  LocalMdxWorkspaceProps,
  LocalMdxWorkspaceSaveState,
} from "./local-mdx-workspace-types";
import {
  resolveInitialWorkspaceMode,
  stripMdxFrontmatter,
  unsupportedMdxReason,
} from "./local-mdx-workspace-utils";
import styles from "./LocalMdxWorkspace.module.css";

export type {
  LocalMdxWorkspaceFormat,
  LocalMdxWorkspaceMode,
  LocalMdxWorkspacePane,
  LocalMdxWorkspaceProps,
  LocalMdxWorkspaceSavePayload,
} from "./local-mdx-workspace-types";
export { stripMdxFrontmatter, unsupportedMdxReason } from "./local-mdx-workspace-utils";

/**
 * A local-first workspace for a Markdown/MDX file. It deliberately owns only
 * the editing session: callers keep responsibility for file reads, writes,
 * OneDrive sync, and navigation.
 */
export function LocalMdxWorkspace(props: LocalMdxWorkspaceProps) {
  // File identity starts a fresh editing session. Persisting the current file
  // must not remount the editor, reset its mode, or discard edits made while a
  // save is in flight.
  const sessionKey = props.fileId ?? `new:${props.title}`;
  return <LocalMdxWorkspaceSession key={sessionKey} {...props} />;
}

function LocalMdxWorkspaceSession({
  source,
  title,
  fileId = null,
  format = "mdx",
  onSave,
  onSourceChange,
  isDesktop = false,
  appearance = "panel",
  initialMode,
  className,
}: LocalMdxWorkspaceProps) {
  const editable = typeof onSave === "function";
  const [draft, setDraft] = useState(source);
  const [savedSource, setSavedSource] = useState(source);
  const [requestedMode, setRequestedMode] = useState<LocalMdxWorkspaceMode>(() =>
    resolveInitialWorkspaceMode(initialMode, editable)
  );
  const [activePane, setActivePane] = useState<LocalMdxWorkspacePane>("source");
  const [saveState, setSaveState] = useState<LocalMdxWorkspaceSaveState>({ kind: "idle" });
  const sourceTextareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef(source);
  const savedSourceRef = useRef(source);
  const savingRef = useRef(false);
  const mode = editable ? requestedMode : "read";
  const previewSource = useMemo(() => stripMdxFrontmatter(draft), [draft]);
  const unsupportedReason = useMemo(
    () => unsupportedMdxReason(previewSource, format),
    [format, previewSource]
  );
  const isDirty = draft !== savedSource;

  useEffect(() => {
    const previousSavedSource = savedSourceRef.current;
    savedSourceRef.current = source;
    setSavedSource(source);
    setDraft((currentDraft) => {
      const nextDraft = currentDraft === previousSavedSource ? source : currentDraft;
      draftRef.current = nextDraft;
      return nextDraft;
    });
  }, [source]);

  const updateDraft = useCallback(
    (nextSource: string) => {
      draftRef.current = nextSource;
      setDraft(nextSource);
      setSaveState((current) => (current.kind === "saving" ? current : { kind: "idle" }));
      onSourceChange?.(nextSource);
    },
    [onSourceChange]
  );

  const handleSave = useCallback(async () => {
    if (!onSave || savingRef.current) return;
    savingRef.current = true;
    const sourceAtSave = draft;
    setSaveState({ kind: "saving" });

    try {
      await onSave({ source: sourceAtSave, title, fileId, format, isDesktop });
      savedSourceRef.current = sourceAtSave;
      setSavedSource(sourceAtSave);
      setSaveState(draftRef.current === sourceAtSave ? { kind: "saved" } : { kind: "idle" });
    } catch (error: unknown) {
      setSaveState({
        kind: "error",
        message: error instanceof Error ? error.message : "Could not save this document.",
      });
    } finally {
      savingRef.current = false;
    }
  }, [draft, fileId, format, isDesktop, onSave, title]);

  useSaveShortcut(editable, handleSave);

  const selectMode = useCallback(
    (nextMode: LocalMdxWorkspaceMode) => {
      if (nextMode === "read" || editable) setRequestedMode(nextMode);
    },
    [editable]
  );
  const selectPane = useCallback(
    (pane: LocalMdxWorkspacePane) => {
      setActivePane(pane);
      if (mode === "split") {
        if (pane === "source") sourceTextareaRef.current?.focus();
        else previewRef.current?.focus();
      }
    },
    [mode]
  );
  const openSource = useCallback(() => {
    if (!editable) return;
    setRequestedMode("edit");
    setActivePane("source");
  }, [editable]);
  const onSourceKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      void handleSave();
    },
    [handleSave]
  );

  return (
    <section
      className={cn(styles.workspace, className)}
      data-appearance={appearance}
      data-mode={mode}
    >
      <WorkspaceToolbar
        title={title}
        fileId={fileId}
        format={format}
        editable={editable}
        mode={mode}
        isDirty={isDirty}
        isDesktop={isDesktop}
        saveState={saveState}
        onModeChange={selectMode}
        onSave={handleSave}
      />
      {saveState.kind !== "idle" ? <SaveNotice state={saveState} isDesktop={isDesktop} /> : null}
      <WorkspaceCanvas
        mode={mode}
        activePane={activePane}
        source={draft}
        previewSource={previewSource}
        format={format}
        unsupportedReason={unsupportedReason}
        sourceTextareaRef={sourceTextareaRef}
        previewRef={previewRef}
        onPaneChange={selectPane}
        onSourceChange={updateDraft}
        onSourceKeyDown={onSourceKeyDown}
        onSourceFocus={() => setActivePane("source")}
        onPreviewFocus={() => setActivePane("preview")}
        onOpenSource={editable ? openSource : undefined}
      />
    </section>
  );
}

function useSaveShortcut(editable: boolean, onSave: () => Promise<void>) {
  useEffect(() => {
    if (!editable) return;
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "s"
      ) {
        return;
      }
      event.preventDefault();
      void onSave();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [editable, onSave]);
}

interface ToolbarProps {
  title: string;
  fileId: string | null;
  format: "md" | "mdx";
  editable: boolean;
  mode: LocalMdxWorkspaceMode;
  isDirty: boolean;
  isDesktop: boolean;
  saveState: LocalMdxWorkspaceSaveState;
  onModeChange: (mode: LocalMdxWorkspaceMode) => void;
  onSave: () => Promise<void>;
}

function WorkspaceToolbar({
  title,
  fileId,
  format,
  editable,
  mode,
  isDirty,
  isDesktop,
  saveState,
  onModeChange,
  onSave,
}: ToolbarProps) {
  const saveLabel = isDesktop ? "Save" : "Save draft";
  return (
    <header className={styles.toolbar}>
      <div className={styles.identity}>
        <span className={styles.fileIcon} aria-hidden>
          <FileText />
        </span>
        <div className={styles.identityCopy}>
          <p className={styles.breadcrumb}>
            <span className={styles.breadcrumbCurrent}>{title || "Untitled"}</span>
          </p>
          <p className={styles.meta}>
            <span>{fileId ? "Local file" : "New draft"}</span>
            <span className={styles.formatLabel}>{format.toUpperCase()}</span>
            {isDirty ? <span className={styles.dirtyMarker}>Unsaved</span> : null}
          </p>
        </div>
      </div>
      <div className={styles.toolbarActions}>
        <ModeControl editable={editable} mode={mode} onChange={onModeChange} />
        {editable ? (
          <button
            type="button"
            className={styles.saveButton}
            onClick={() => void onSave()}
            disabled={saveState.kind === "saving"}
            aria-label={`${saveLabel} ${title || "document"}`}
          >
            {saveState.kind === "saved" ? <Check aria-hidden /> : <Save aria-hidden />}
            {saveState.kind === "saving" ? "Saving…" : saveLabel}
          </button>
        ) : null}
      </div>
    </header>
  );
}

interface CanvasProps {
  mode: LocalMdxWorkspaceMode;
  activePane: LocalMdxWorkspacePane;
  source: string;
  previewSource: string;
  format: "md" | "mdx";
  unsupportedReason: string | null;
  sourceTextareaRef: RefObject<HTMLTextAreaElement | null>;
  previewRef: RefObject<HTMLDivElement | null>;
  onPaneChange: (pane: LocalMdxWorkspacePane) => void;
  onSourceChange: (source: string) => void;
  onSourceKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onSourceFocus: () => void;
  onPreviewFocus: () => void;
  onOpenSource?: () => void;
}

function WorkspaceCanvas({
  mode,
  activePane,
  source,
  previewSource,
  format,
  unsupportedReason,
  sourceTextareaRef,
  previewRef,
  onPaneChange,
  onSourceChange,
  onSourceKeyDown,
  onSourceFocus,
  onPreviewFocus,
  onOpenSource,
}: CanvasProps) {
  if (mode === "read") {
    return (
      <div className={styles.readPane}>
        <PreviewPane
          source={previewSource}
          format={format}
          unsupportedReason={unsupportedReason}
          onOpenSource={onOpenSource}
        />
      </div>
    );
  }

  return (
    <>
      <div className={styles.paneToolbar}>
        <PaneControl activePane={activePane} onChange={onPaneChange} />
        <span className={styles.paneHint}>
          {mode === "split" ? "Both panes stay in sync" : "Type / to insert a block"}
        </span>
      </div>
      {mode === "edit" ? (
        <div className={styles.editPane}>
          {activePane === "source" ? (
            <SourcePane
              ref={sourceTextareaRef}
              format={format}
              source={source}
              onChange={onSourceChange}
              onKeyDown={onSourceKeyDown}
            />
          ) : (
            <PreviewPane
              source={previewSource}
              format={format}
              unsupportedReason={unsupportedReason}
              onOpenSource={onOpenSource}
            />
          )}
        </div>
      ) : (
        <div className={styles.splitGrid}>
          <SplitSection
            active={activePane === "source"}
            icon={<Code2 aria-hidden />}
            label="Source"
          >
            <SourcePane
              ref={sourceTextareaRef}
              format={format}
              source={source}
              onChange={onSourceChange}
              onKeyDown={onSourceKeyDown}
              onFocus={onSourceFocus}
            />
          </SplitSection>
          <SplitSection
            active={activePane === "preview"}
            icon={<Eye aria-hidden />}
            label="Preview"
          >
            <div ref={previewRef} tabIndex={-1} className={styles.previewFocusTarget}>
              <PreviewPane
                source={previewSource}
                format={format}
                unsupportedReason={unsupportedReason}
                onOpenSource={onOpenSource}
                onFocus={onPreviewFocus}
              />
            </div>
          </SplitSection>
        </div>
      )}
    </>
  );
}

function SplitSection({
  active,
  icon,
  label,
  children,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(styles.splitPane, active && styles.isActivePane)} aria-label={label}>
      <div className={styles.splitHeading}>
        {icon}
        <span>{label}</span>
      </div>
      {children}
    </section>
  );
}
