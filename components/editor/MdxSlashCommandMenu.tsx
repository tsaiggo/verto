"use client";

import {
  Bookmark,
  Braces,
  CheckSquare2,
  ChevronsUpDown,
  Code2,
  Heading2,
  Image as ImageIcon,
  List,
  MessageSquareText,
  Minus,
  Quote,
  Table2,
} from "lucide-react";
import { forwardRef } from "react";

import type {
  MdxSlashCommand,
  MdxSlashCommandGroup,
  MdxSlashCommandIcon,
} from "./mdx-slash-commands";
import styles from "./MdxSourceEditor.module.css";

const COMMAND_GROUPS: readonly MdxSlashCommandGroup[] = ["Basic blocks", "Verto blocks"];

interface MdxSlashCommandMenuProps {
  activeIndex: number;
  commands: readonly MdxSlashCommand[];
  emptyMessage: string;
  id: string;
  left: number;
  onHighlight: (index: number) => void;
  onInsert: (command: MdxSlashCommand) => void;
  top: number;
}

export const MdxSlashCommandMenu = forwardRef<HTMLDivElement, MdxSlashCommandMenuProps>(
  function MdxSlashCommandMenu(
    { activeIndex, commands, emptyMessage, id, left, onHighlight, onInsert, top },
    ref
  ) {
    return (
      <div
        ref={ref}
        id={id}
        className={styles.menu}
        role="listbox"
        aria-label="Insert a block"
        style={{ left, top }}
        onMouseDown={(event) => event.preventDefault()}
      >
        {commands.length > 0 ? (
          COMMAND_GROUPS.map((group) => {
            const groupedCommands = commands.filter((command) => command.group === group);
            if (groupedCommands.length === 0) return null;
            const groupId = `${id}-group-${group.replace(/\s+/g, "-").toLowerCase()}`;
            return (
              <div key={group} className={styles.group} role="group" aria-labelledby={groupId}>
                <span id={groupId} className={styles.groupLabel}>
                  {group}
                </span>
                {groupedCommands.map((command) => {
                  const commandIndex = commands.indexOf(command);
                  const selected = commandIndex === activeIndex;
                  return (
                    <button
                      key={command.id}
                      id={`${id}-option-${command.id}`}
                      type="button"
                      className={styles.option}
                      role="option"
                      aria-selected={selected}
                      onClick={() => onInsert(command)}
                      onPointerMove={() => onHighlight(commandIndex)}
                    >
                      <span className={styles.icon} aria-hidden>
                        <CommandIcon name={command.icon} />
                      </span>
                      <span className={styles.copy}>
                        <span className={styles.label}>{command.label}</span>
                        <span className={styles.description}>{command.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })
        ) : (
          <p className={styles.empty}>{emptyMessage}</p>
        )}
      </div>
    );
  }
);

function CommandIcon({ name }: { name: MdxSlashCommandIcon }) {
  switch (name) {
    case "bookmark":
      return <Bookmark />;
    case "callout":
      return <MessageSquareText />;
    case "code":
      return <Code2 />;
    case "divider":
      return <Minus />;
    case "heading":
      return <Heading2 />;
    case "image":
      return <ImageIcon />;
    case "list":
      return <List />;
    case "quote":
      return <Quote />;
    case "table":
      return <Table2 />;
    case "task":
      return <CheckSquare2 />;
    case "toggle":
      return <ChevronsUpDown />;
    default:
      return <Braces />;
  }
}
