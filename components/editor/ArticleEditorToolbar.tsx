"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { BookOpen, Check, Code2, Download, Eye, Loader2, Save, Sparkles } from "lucide-react";
import type { ArticleSaveStatus } from "./ArticleEditorDocument";
import styles from "./ArticleEditorToolbar.module.css";

export type ArticleEditorTab = "source" | "preview";

interface ArticleEditorToolbarProps {
  tab: ArticleEditorTab;
  onTabChange: (tab: ArticleEditorTab) => void;
  aiReviewOpen: boolean;
  onToggleAiReview: () => void;
  filename: string;
  onFilenameChange: (filename: string) => void;
  filenameEditable: boolean;
  filenameDisabled: boolean;
  desktop: boolean;
  isCopy: boolean;
  hasSource: boolean;
  dirty: boolean;
  saveStatus: ArticleSaveStatus;
  canSave: boolean;
  readHref?: string;
  onSave: () => void;
  onExport: () => void;
  pageControls?: ReactNode;
  breadcrumbs?: ReactNode;
  storageScope?: string;
  savedLabel?: string;
  navigationToggle?: ReactNode;
  documentSwitcher?: ReactNode;
}

function saveLabel(status: ArticleSaveStatus, dirty: boolean, desktop: boolean) {
  if (status === "saving") return "Saving…";
  if (status === "conflict") return "Conflicting version";
  if (status === "error") return "Not saved";
  if (dirty) return "Unsaved changes";
  if (status === "saved") return desktop ? "Saved to local library" : "Saved in this browser";
  return desktop ? "Local draft" : "Start writing to save a draft";
}

function storageLabel(props: ArticleEditorToolbarProps) {
  if (props.storageScope !== undefined) return props.storageScope;
  if (props.desktop) return "Local library";
  if (props.isCopy) return "Browser copy";
  return props.hasSource ? "Saves a browser copy" : "This browser";
}

export function ArticleEditorToolbar(props: ArticleEditorToolbarProps) {
  const viewRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const views = ["source", "preview"] as const;
  const changeView = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : (index + 1) % 2;
    props.onTabChange(views[next]);
    viewRefs.current[next]?.focus();
  };
  const storageScope = storageLabel(props);
  const saved = props.saveStatus === "saved" && !props.dirty;
  const statusLabel =
    saved && props.savedLabel
      ? props.savedLabel
      : saveLabel(props.saveStatus, props.dirty, props.desktop);
  const storageDescription =
    props.hasSource && !props.desktop
      ? `${storageScope}. Editing keeps a separate copy in this browser. The source document is unchanged.`
      : storageScope;
  return (
    <div className={styles.toolbar} data-article-editor-toolbar>
      <div className={styles.breadcrumbRow}>
        {props.breadcrumbs && <div className={styles.breadcrumbs}>{props.breadcrumbs}</div>}
        <div className={styles.actions}>
          {props.pageControls}
          {props.readHref && (
            <a className={styles.quietButton} href={props.readHref}>
              <BookOpen aria-hidden />
              Read
            </a>
          )}
          <button className={styles.quietButton} type="button" onClick={props.onExport}>
            <Download aria-hidden />
            Export
          </button>
          <button
            className={styles.saveButton}
            type="button"
            onClick={props.onSave}
            disabled={!props.canSave}
          >
            <Save aria-hidden />
            {props.saveStatus === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <div className={styles.viewRow}>
        <div className={styles.identity}>
          {props.navigationToggle}
          {props.filenameEditable ? (
            <input
              className={styles.filename}
              value={props.filename}
              onChange={(event) => props.onFilenameChange(event.target.value)}
              aria-label="Filename"
              title={props.filename}
              disabled={props.filenameDisabled}
              placeholder="untitled.mdx"
            />
          ) : (
            <span className={styles.filenameLabel} title={props.filename}>
              {props.filename}
            </span>
          )}
          {props.documentSwitcher}
        </div>
        <div className={styles.views} role="group" aria-label="Document view">
          {views.map((view, index) => (
            <button
              key={view}
              type="button"
              ref={(node) => {
                viewRefs.current[index] = node;
              }}
              className={styles.view}
              aria-pressed={props.tab === view}
              aria-controls="editor-document-panel"
              tabIndex={props.tab === view ? 0 : -1}
              onClick={() => props.onTabChange(view)}
              onKeyDown={(event) => changeView(event, index)}
            >
              {view === "source" ? <Code2 aria-hidden /> : <Eye aria-hidden />}
              {view === "source" ? "Source" : "Preview"}
            </button>
          ))}
        </div>
        <span
          className={styles.status}
          role="status"
          data-save-status={props.saveStatus}
          title={`${statusLabel} · ${storageDescription}`}
        >
          <span className={styles.statusMessage}>
            {props.saveStatus === "saving" ? (
              <Loader2 className={styles.spinner} aria-hidden />
            ) : saved ? (
              <Check aria-hidden />
            ) : null}
            {statusLabel}
          </span>
          {(!saved || props.isCopy) && <span className={styles.context}>{storageScope}</span>}
        </span>
        <button
          className={styles.aiButton}
          type="button"
          onClick={props.onToggleAiReview}
          aria-controls="editor-ai-review"
          aria-expanded={props.aiReviewOpen}
        >
          <Sparkles aria-hidden />
          Edit with AI
        </button>
      </div>
    </div>
  );
}
