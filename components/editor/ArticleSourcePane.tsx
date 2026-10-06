"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { MdxSourceEditor } from "./MdxSourceEditor";
import { clampEditorMenuPosition, measureTextareaCaret } from "./mdx-source-editor-caret";
import {
  ArticleFormattingToolbar,
  articleFormatting,
  type ArticleFormatCommand,
} from "./ArticleFormattingToolbar";
import styles from "./ArticleSourcePane.module.css";

interface Selection {
  start: number;
  end: number;
  left: number;
  top: number;
}

export function ArticleSourcePane({
  source,
  format,
  onSourceChange,
  readOnly,
  onAskAi,
}: {
  source: string;
  format: "md" | "mdx";
  onSourceChange: (source: string) => void;
  readOnly: boolean;
  onAskAi: (text: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const composingRef = useRef(false);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const dismissedRef = useRef("");
  const [selection, setSelection] = useState<Selection | null>(null);

  const syncSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (
      !textarea ||
      readOnly ||
      composingRef.current ||
      textarea.selectionStart === textarea.selectionEnd
    ) {
      setSelection(null);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (dismissedRef.current === `${start}:${end}:${textarea.value}`) return;
    const position = measureTextareaCaret(textarea, start);
    const root = rootRef.current;
    const compact = window.innerWidth <= 700;
    const menuWidth = compact ? 296 : 256;
    const menuHeight = compact ? 56 : 44;
    setSelection({
      start,
      end,
      left: clampEditorMenuPosition(
        position.left,
        8,
        Math.max(8, (root?.clientWidth ?? 0) - menuWidth)
      ),
      top: clampEditorMenuPosition(
        position.top < menuHeight + 8
          ? position.top + position.lineHeight + 8
          : position.top - menuHeight,
        8,
        Math.max(8, (root?.clientHeight ?? 0) - menuHeight)
      ),
    });
  }, [readOnly]);

  const hasSelection = selection !== null;
  useLayoutEffect(() => {
    if (!hasSelection) return;
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncSelection);
    if (rootRef.current) observer?.observe(rootRef.current);
    window.addEventListener("resize", syncSelection);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncSelection);
    };
  }, [hasSelection, syncSelection]);

  function dismiss() {
    const textarea = textareaRef.current;
    if (textarea) {
      dismissedRef.current = `${textarea.selectionStart}:${textarea.selectionEnd}:${textarea.value}`;
      textarea.focus();
    }
    setSelection(null);
  }

  function formatSelection(command: ArticleFormatCommand) {
    const textarea = textareaRef.current;
    if (!textarea || readOnly || composingRef.current || !selection) return;
    const insertion = articleFormatting(source, selection.start, selection.end, command);
    textarea.focus();
    textarea.setSelectionRange(selection.start, selection.end);
    pendingSelectionRef.current = { start: insertion.start, end: insertion.end };
    // Use the same native textarea insertion bridge as slash commands. This is
    // not a second editor engine: it preserves the browser's undo transaction.
    if (typeof document.execCommand === "function")
      document.execCommand("insertText", false, insertion.replacement);
    onSourceChange(insertion.source);
    setSelection(null);
  }

  useLayoutEffect(() => {
    const pending = pendingSelectionRef.current;
    const textarea = textareaRef.current;
    if (!pending || !textarea) return;
    pendingSelectionRef.current = null;
    textarea.focus();
    textarea.setSelectionRange(pending.start, pending.end);
  }, [source]);

  return (
    <div className={styles.root} ref={rootRef}>
      <MdxSourceEditor
        ref={textareaRef}
        textareaClassName={`ed-source-textarea ${styles.textarea}`}
        value={source}
        format={format}
        onValueChange={(value) => {
          setSelection(null);
          onSourceChange(value);
        }}
        spellCheck={false}
        aria-label="MDX source"
        readOnly={readOnly}
        onSelect={syncSelection}
        onScroll={syncSelection}
        onKeyUp={syncSelection}
        onCompositionStart={() => {
          composingRef.current = true;
          setSelection(null);
        }}
        onCompositionEnd={() => {
          composingRef.current = false;
        }}
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setSelection(null);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || composingRef.current) return;
          if (event.key === "Escape" && selection) {
            event.preventDefault();
            dismiss();
          }
          if (
            (event.ctrlKey || event.metaKey) &&
            !event.altKey &&
            selection &&
            ["b", "i"].includes(event.key.toLowerCase())
          ) {
            event.preventDefault();
            formatSelection(event.key.toLowerCase() === "b" ? "bold" : "italic");
          }
        }}
      />
      {selection && (
        <ArticleFormattingToolbar
          left={selection.left}
          top={selection.top}
          onFormat={formatSelection}
          onDismiss={dismiss}
          onAskAi={() => {
            onAskAi(source.slice(selection.start, selection.end));
            dismiss();
          }}
        />
      )}
    </div>
  );
}
