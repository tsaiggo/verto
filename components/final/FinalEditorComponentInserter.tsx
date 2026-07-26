"use client";

import { useState } from "react";

import { MdxSlashCommandMenu } from "@/components/editor/MdxSlashCommandMenu";
import {
  filterMdxSlashCommands,
  type MdxSlashCommand,
} from "@/components/editor/mdx-slash-commands";

const CALLOUT_COMMANDS = filterMdxSlashCommands("callout", "mdx");

export function FinalEditorComponentInserter() {
  const [activeIndex, setActiveIndex] = useState(0);

  function selectCommand(command: MdxSlashCommand) {
    const commandIndex = CALLOUT_COMMANDS.indexOf(command);
    if (commandIndex >= 0) setActiveIndex(commandIndex);
  }

  return (
    <MdxSlashCommandMenu
      activeIndex={activeIndex}
      commands={CALLOUT_COMMANDS}
      emptyMessage="No matching blocks."
      id="final-editor-component-inserter"
      left={72}
      onHighlight={setActiveIndex}
      onInsert={selectCommand}
      top={342}
    />
  );
}
