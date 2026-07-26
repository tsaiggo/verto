import { describe, expect, it } from "vitest";

import {
  applyMdxSlashCommand,
  filterMdxSlashCommands,
  findMdxSlashTrigger,
  hasMdxOnlySlashMatch,
  MDX_SLASH_COMMANDS,
} from "./mdx-slash-commands";

describe("MDX slash commands", () => {
  it("detects an indented slash query only on an otherwise empty line", () => {
    const source = "# Notes\n\n  /cal";
    expect(findMdxSlashTrigger(source, source.length)).toEqual({
      start: "# Notes\n\n  ".length,
      end: source.length,
      indent: "  ",
      query: "cal",
    });

    expect(
      findMdxSlashTrigger("Visit https://example.com/", "Visit https://example.com/".length)
    ).toBeNull();
    expect(findMdxSlashTrigger("<Callout /", "<Callout /".length)).toBeNull();
    expect(findMdxSlashTrigger("Text /cal", "Text /cal".length)).toBeNull();
  });

  it("does not trigger in frontmatter or fenced code", () => {
    const frontmatter = "---\ntitle: Test\n/cal\n---\n";
    expect(findMdxSlashTrigger(frontmatter, frontmatter.indexOf("/cal") + 4)).toBeNull();

    const fenced = "```md\n/cal\n```\n";
    expect(findMdxSlashTrigger(fenced, fenced.indexOf("/cal") + 4)).toBeNull();

    const afterFence = "```md\n/cal\n```\n/cal";
    expect(findMdxSlashTrigger(afterFence, afterFence.length)?.query).toBe("cal");
  });

  it("keeps rich blocks exclusive to MDX files", () => {
    expect(filterMdxSlashCommands("callout", "md")).toEqual([]);
    expect(filterMdxSlashCommands("callout", "mdx").map((command) => command.id)).toEqual([
      "note",
      "tip",
      "warning",
    ]);
    expect(hasMdxOnlySlashMatch("callout")).toBe(true);
    expect(hasMdxOnlySlashMatch("heading")).toBe(false);
  });

  it("replaces only the slash token and preserves indentation, CRLF, and selection", () => {
    const source = "Before\r\n  /note\r\nAfter";
    const trigger = findMdxSlashTrigger(source, source.indexOf("/note") + 5);
    const command = MDX_SLASH_COMMANDS.find((candidate) => candidate.id === "note");
    if (!trigger || !command) throw new Error("Expected note command and trigger");

    const insertion = applyMdxSlashCommand(source, trigger, command);
    expect(insertion.source).toBe(
      'Before\r\n  <Callout type="info">\r\n    Write a note.\r\n  </Callout>\r\nAfter'
    );
    expect(insertion.source.slice(insertion.selectionStart, insertion.selectionEnd)).toBe(
      "Write a note."
    );
    expect(insertion.source).not.toMatch(/[\uE000\uE001]/);
  });

  it("keeps command ranking deterministic", () => {
    expect(filterMdxSlashCommands("h2", "mdx")[0]?.id).toBe("heading-2");
    expect(filterMdxSlashCommands("todo", "mdx")[0]?.id).toBe("task");
    expect(filterMdxSlashCommands("书签", "mdx")[0]?.id).toBe("bookmark");
    expect(filterMdxSlashCommands("bookmark", "mdx")[0]?.template).toContain(
      'url="\uE000https://example.com\uE001"'
    );
  });
});
