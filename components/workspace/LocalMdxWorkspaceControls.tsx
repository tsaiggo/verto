"use client";

import { Code2, Columns2, Eye } from "lucide-react";

import { cn } from "@/lib/utils";

import type {
  LocalMdxWorkspaceMode,
  LocalMdxWorkspacePane,
  LocalMdxWorkspaceSaveState,
} from "./local-mdx-workspace-types";
import styles from "./LocalMdxWorkspace.module.css";

const MODE_OPTIONS: ReadonlyArray<{
  mode: LocalMdxWorkspaceMode;
  label: string;
  icon: typeof Eye;
}> = [
  { mode: "read", label: "Read", icon: Eye },
  { mode: "edit", label: "Edit", icon: Code2 },
  { mode: "split", label: "Split", icon: Columns2 },
];

export function ModeControl({
  editable,
  mode,
  onChange,
}: {
  editable: boolean;
  mode: LocalMdxWorkspaceMode;
  onChange: (mode: LocalMdxWorkspaceMode) => void;
}) {
  return (
    <div className={styles.segmentedControl} role="group" aria-label="Workspace mode">
      {MODE_OPTIONS.map(({ mode: optionMode, label, icon: Icon }) => {
        const disabled = optionMode !== "read" && !editable;
        return (
          <button
            key={optionMode}
            type="button"
            className={cn(styles.segmentButton, mode === optionMode && styles.isSelected)}
            onClick={() => onChange(optionMode)}
            aria-pressed={mode === optionMode}
            disabled={disabled}
            title={disabled ? "A save handler is required to edit this document." : label}
          >
            <Icon aria-hidden />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PaneControl({
  activePane,
  onChange,
}: {
  activePane: LocalMdxWorkspacePane;
  onChange: (pane: LocalMdxWorkspacePane) => void;
}) {
  return (
    <div className={styles.paneControl} role="group" aria-label="Editor pane">
      {(["source", "preview"] as const).map((pane) => (
        <button
          key={pane}
          type="button"
          className={cn(styles.paneButton, activePane === pane && styles.isSelected)}
          onClick={() => onChange(pane)}
          aria-pressed={activePane === pane}
        >
          {pane === "source" ? "Source" : "Preview"}
        </button>
      ))}
    </div>
  );
}

export function SaveNotice({
  state,
  isDesktop,
}: {
  state: LocalMdxWorkspaceSaveState;
  isDesktop: boolean;
}) {
  if (state.kind === "saving") {
    return (
      <p className={styles.saveNotice} role="status">
        Saving document…
      </p>
    );
  }
  if (state.kind === "saved") {
    return (
      <p className={styles.saveNotice} role="status">
        {isDesktop ? "Saved to your local folder." : "Draft saved."}
      </p>
    );
  }
  if (state.kind === "error") {
    return (
      <p className={cn(styles.saveNotice, styles.saveError)} role="alert">
        {state.message}
      </p>
    );
  }
  return null;
}
