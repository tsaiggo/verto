"use client";

import { Bold, Code, Italic, Link2, Sparkles } from "lucide-react";
import PlatformShortcut from "@/components/layout/PlatformShortcut";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
    { command: "bold", label: "Bold", Icon: Bold, shortcut: "B" },
    { command: "italic", label: "Italic", Icon: Italic, shortcut: "I" },
    { command: "code", label: "Inline code", Icon: Code, shortcut: null },
    { command: "link", label: "Link", Icon: Link2, shortcut: null },
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
      <TooltipProvider delayDuration={400} disableHoverableContent>
        <div className={styles.formatGroup} role="group" aria-label="Markdown formatting">
          {controls.map(({ command, label, Icon, shortcut }) => (
            <Tooltip key={command}>
              <TooltipTrigger asChild>
                <button type="button" aria-label={label} onClick={() => onFormat(command)}>
                  <Icon aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent className={styles.tooltip} side="top" sideOffset={8}>
                {label}
                {shortcut && <PlatformShortcut className={styles.shortcut} command={shortcut} />}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
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
