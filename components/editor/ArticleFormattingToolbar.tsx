"use client";

import { Bold, Code, Italic, Link2, Sparkles } from "lucide-react";
import styles from "./ArticleFormattingToolbar.module.css";

export type ArticleFormatCommand = "bold" | "italic" | "code" | "link";

export function articleFormatting(
  source: string,
  start: number,
  end: number,
  command: ArticleFormatCommand
) {
  const selected = source.slice(start, end);
  const marker = command === "bold" ? "**" : command === "italic" ? "*" : "`";
  if (command === "link") {
    const replacement = `[${selected}](https://)`;
    return {
      replacement,
      source: source.slice(0, start) + replacement + source.slice(end),
      start: start + selected.length + 3,
      end: start + selected.length + 11,
    };
  }
  const unwrap =
    selected.startsWith(marker) && selected.endsWith(marker) && selected.length > marker.length * 2;
  const replacement = unwrap
    ? selected.slice(marker.length, -marker.length)
    : marker + selected + marker;
  return {
    replacement,
    source: source.slice(0, start) + replacement + source.slice(end),
    start,
    end: start + replacement.length,
  };
}

export function ArticleFormattingToolbar({
  left,
  top,
  onFormat,
  onAskAi,
  onDismiss,
}: {
  left: number;
  top: number;
  onFormat: (command: ArticleFormatCommand) => void;
  onAskAi: () => void;
  onDismiss: () => void;
}) {
  const controls = [
    { command: "bold", label: "Bold", Icon: Bold },
    { command: "italic", label: "Italic", Icon: Italic },
    { command: "code", label: "Inline code", Icon: Code },
    { command: "link", label: "Link", Icon: Link2 },
  ] as const;
  return (
    <div
      className={styles.toolbar}
      role="toolbar"
      aria-label="Text formatting"
      style={{ left, top }}
      onMouseDown={(event) => {
        if ((event.target as Element).closest("button")) event.preventDefault();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onDismiss();
        }
      }}
    >
      {controls.map(({ command, label, Icon }) => (
        <button
          type="button"
          key={command}
          aria-label={label}
          title={label}
          onClick={() => onFormat(command)}
        >
          <Icon aria-hidden />
        </button>
      ))}
      <span className={styles.divider} aria-hidden />
      <button
        className={styles.ai}
        type="button"
        onClick={onAskAi}
        aria-label="Ask AI about selected text"
      >
        <Sparkles aria-hidden />
        Ask AI
      </button>
    </div>
  );
}
