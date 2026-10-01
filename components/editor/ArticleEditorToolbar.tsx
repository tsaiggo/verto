"use client";

import { useRef, type KeyboardEvent } from "react";
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
}

function saveLabel(status: ArticleSaveStatus, dirty: boolean, desktop: boolean) {
  if (status === "saving") return "Saving…";
  if (status === "conflict") return "Conflicting version";
  if (status === "error") return "Not saved";
  if (dirty) return "Unsaved changes";
  if (status === "saved") return desktop ? "Saved to local library" : "Saved in this browser";
  return desktop ? "Local draft" : "Start writing to save a draft";
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
  const context = props.desktop
    ? "Local library"
    : props.isCopy
      ? "Browser copy"
      : props.hasSource
        ? "Saves a browser copy"
        : "This browser";
  return (
    <div className={styles.toolbar} data-article-editor-toolbar>
      <div className={styles.identityRow}>
        <div className={styles.identity}>
          {props.filenameEditable ? (
            <input
              className={styles.filename}
              value={props.filename}
              onChange={(event) => props.onFilenameChange(event.target.value)}
              aria-label="Filename"
              disabled={props.filenameDisabled}
              placeholder="untitled.mdx"
            />
          ) : (
            <span className={styles.filenameLabel} title={props.filename}>
              {props.filename}
            </span>
          )}
          <span
            className={styles.context}
            title={
              props.hasSource && !props.desktop
                ? "Editing keeps a separate copy in this browser. The source document is unchanged."
                : undefined
            }
          >
            {context}
          </span>
        </div>
        <div className={styles.actions}>
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
        <span className={styles.status} role="status" data-save-status={props.saveStatus}>
          {props.saveStatus === "saving" ? (
            <Loader2 className={styles.spinner} aria-hidden />
          ) : props.saveStatus === "saved" && !props.dirty ? (
            <Check aria-hidden />
          ) : null}
          {saveLabel(props.saveStatus, props.dirty, props.desktop)}
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
