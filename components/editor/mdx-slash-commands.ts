export type MdxSlashCommandFormat = "md" | "mdx";
export type MdxSlashCommandGroup = "Basic blocks" | "Verto blocks";
export type MdxSlashCommandIcon =
  | "bookmark"
  | "callout"
  | "code"
  | "divider"
  | "heading"
  | "image"
  | "list"
  | "quote"
  | "table"
  | "task"
  | "toggle";

export interface MdxSlashCommand {
  id: string;
  label: string;
  description: string;
  group: MdxSlashCommandGroup;
  icon: MdxSlashCommandIcon;
  keywords: readonly string[];
  formats: readonly MdxSlashCommandFormat[];
  template: string;
}

export interface MdxSlashTrigger {
  start: number;
  end: number;
  indent: string;
  query: string;
}

export interface MdxSlashInsertion {
  source: string;
  replacement: string;
  selectionStart: number;
  selectionEnd: number;
}

const SELECTION_START = "\uE000";
const SELECTION_END = "\uE001";
const MARKDOWN_FORMATS = ["md", "mdx"] as const;
const MDX_FORMATS = ["mdx"] as const;

export const MDX_SLASH_COMMANDS: readonly MdxSlashCommand[] = [
  {
    id: "heading-2",
    label: "Heading 2",
    description: "Start a section",
    group: "Basic blocks",
    icon: "heading",
    keywords: ["h2", "heading", "section", "标题"],
    formats: MARKDOWN_FORMATS,
    template: `## ${SELECTION_START}Section heading${SELECTION_END}`,
  },
  {
    id: "heading-3",
    label: "Heading 3",
    description: "Start a subsection",
    group: "Basic blocks",
    icon: "heading",
    keywords: ["h3", "subheading", "subsection", "小标题"],
    formats: MARKDOWN_FORMATS,
    template: `### ${SELECTION_START}Subsection heading${SELECTION_END}`,
  },
  {
    id: "bulleted-list",
    label: "Bulleted list",
    description: "Create an unordered list",
    group: "Basic blocks",
    icon: "list",
    keywords: ["bullet", "list", "ul", "无序列表"],
    formats: MARKDOWN_FORMATS,
    template: `- ${SELECTION_START}List item${SELECTION_END}`,
  },
  {
    id: "numbered-list",
    label: "Numbered list",
    description: "Create an ordered list",
    group: "Basic blocks",
    icon: "list",
    keywords: ["number", "ordered", "list", "ol", "有序列表"],
    formats: MARKDOWN_FORMATS,
    template: `1. ${SELECTION_START}List item${SELECTION_END}`,
  },
  {
    id: "task",
    label: "To-do",
    description: "Add a checkable task",
    group: "Basic blocks",
    icon: "task",
    keywords: ["todo", "task", "checkbox", "待办"],
    formats: MARKDOWN_FORMATS,
    template: `- [ ] ${SELECTION_START}Task${SELECTION_END}`,
  },
  {
    id: "quote",
    label: "Quote",
    description: "Set text apart",
    group: "Basic blocks",
    icon: "quote",
    keywords: ["blockquote", "citation", "引用"],
    formats: MARKDOWN_FORMATS,
    template: `> ${SELECTION_START}Quote${SELECTION_END}`,
  },
  {
    id: "code",
    label: "Code block",
    description: "Add a fenced code block",
    group: "Basic blocks",
    icon: "code",
    keywords: ["code", "snippet", "代码"],
    formats: MARKDOWN_FORMATS,
    template: `\`\`\`\n${SELECTION_START}Write code here.${SELECTION_END}\n\`\`\``,
  },
  {
    id: "divider",
    label: "Divider",
    description: "Separate two sections",
    group: "Basic blocks",
    icon: "divider",
    keywords: ["rule", "separator", "hr", "分割线"],
    formats: MARKDOWN_FORMATS,
    template: "***",
  },
  {
    id: "table",
    label: "Table",
    description: "Insert a simple table",
    group: "Basic blocks",
    icon: "table",
    keywords: ["grid", "columns", "表格"],
    formats: MARKDOWN_FORMATS,
    template: `| ${SELECTION_START}Column 1${SELECTION_END} | Column 2 |\n| --- | --- |\n| Value 1 | Value 2 |`,
  },
  {
    id: "image",
    label: "Image",
    description: "Reference an image file",
    group: "Basic blocks",
    icon: "image",
    keywords: ["img", "photo", "picture", "图片"],
    formats: MARKDOWN_FORMATS,
    template: `![Alt text](${SELECTION_START}/path/to/image.png${SELECTION_END})`,
  },
  {
    id: "note",
    label: "Note",
    description: "Highlight useful context",
    group: "Verto blocks",
    icon: "callout",
    keywords: ["callout", "info", "note", "提示"],
    formats: MDX_FORMATS,
    template: `<Callout type="info">\n  ${SELECTION_START}Write a note.${SELECTION_END}\n</Callout>`,
  },
  {
    id: "tip",
    label: "Tip",
    description: "Share a practical suggestion",
    group: "Verto blocks",
    icon: "callout",
    keywords: ["callout", "hint", "advice", "技巧"],
    formats: MDX_FORMATS,
    template: `<Callout type="tip">\n  ${SELECTION_START}Share a tip.${SELECTION_END}\n</Callout>`,
  },
  {
    id: "warning",
    label: "Warning",
    description: "Call out a risk",
    group: "Verto blocks",
    icon: "callout",
    keywords: ["callout", "warn", "caution", "警告"],
    formats: MDX_FORMATS,
    template: `<Callout type="warning">\n  ${SELECTION_START}Describe the risk.${SELECTION_END}\n</Callout>`,
  },
  {
    id: "toggle",
    label: "Toggle",
    description: "Hide optional detail",
    group: "Verto blocks",
    icon: "toggle",
    keywords: ["details", "disclosure", "collapse", "折叠"],
    formats: MDX_FORMATS,
    template: `<Toggle title="Details">\n  ${SELECTION_START}Add supporting detail.${SELECTION_END}\n</Toggle>`,
  },
  {
    id: "bookmark",
    label: "Bookmark",
    description: "Give a link more context",
    group: "Verto blocks",
    icon: "bookmark",
    keywords: ["link", "card", "url", "书签"],
    formats: MDX_FORMATS,
    template:
      `<BookmarkCard\n` +
      `  url="${SELECTION_START}https://example.com${SELECTION_END}"\n` +
      `  title="Bookmark title"\n` +
      `  description="Why this link matters."\n` +
      `/>`,
  },
] as const;

export function findMdxSlashTrigger(source: string, caret: number): MdxSlashTrigger | null {
  if (caret < 0 || caret > source.length) return null;
  const lineStart = source.lastIndexOf("\n", Math.max(0, caret - 1)) + 1;
  const lineEndIndex = source.indexOf("\n", caret);
  const lineEnd = lineEndIndex < 0 ? source.length : lineEndIndex;
  if (source.slice(caret, lineEnd).trim()) return null;
  if (isInsideFrontmatter(source, lineStart) || isInsideCodeFence(source, lineStart)) return null;

  const beforeCaret = source.slice(lineStart, caret);
  const match = /^([ \t]*)[\/／]([^\n]*)$/.exec(beforeCaret);
  if (!match) return null;

  const indent = match[1] ?? "";
  const query = (match[2] ?? "").trimStart();
  return {
    start: lineStart + indent.length,
    end: caret,
    indent,
    query,
  };
}

export function filterMdxSlashCommands(
  query: string,
  format: MdxSlashCommandFormat
): MdxSlashCommand[] {
  const normalized = normalizeQuery(query);
  return MDX_SLASH_COMMANDS.filter((command) => command.formats.includes(format))
    .map((command, order) => ({ command, order, score: commandScore(command, normalized) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((entry) => entry.command);
}

export function hasMdxOnlySlashMatch(query: string): boolean {
  const normalized = normalizeQuery(query);
  return MDX_SLASH_COMMANDS.some(
    (command) =>
      command.formats.length === 1 &&
      command.formats[0] === "mdx" &&
      commandScore(command, normalized) >= 0
  );
}

export function applyMdxSlashCommand(
  source: string,
  trigger: MdxSlashTrigger,
  command: MdxSlashCommand
): MdxSlashInsertion {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const normalizedTemplate = command.template.replace(/\n/g, newline);
  const indentedTemplate = normalizedTemplate.replace(
    new RegExp(`${escapeRegExp(newline)}(?=.)`, "g"),
    `${newline}${trigger.indent}`
  );
  const markedStart = indentedTemplate.indexOf(SELECTION_START);
  const markedEnd = indentedTemplate.indexOf(SELECTION_END);
  const replacement = indentedTemplate.replace(SELECTION_START, "").replace(SELECTION_END, "");
  const prefix = source.slice(0, trigger.start);
  const suffix = source.slice(trigger.end);
  const selectionStart = prefix.length + (markedStart >= 0 ? markedStart : replacement.length);
  const selectionEnd =
    markedStart >= 0 && markedEnd > markedStart
      ? prefix.length + markedEnd - SELECTION_START.length
      : selectionStart;

  return {
    source: prefix + replacement + suffix,
    replacement,
    selectionStart,
    selectionEnd,
  };
}

function commandScore(command: MdxSlashCommand, query: string): number {
  if (!query) return 0;
  const label = normalizeQuery(command.label);
  if (label === query) return 120;
  if (label.startsWith(query)) return 100;
  if (command.keywords.some((keyword) => normalizeQuery(keyword) === query)) return 90;
  if (command.keywords.some((keyword) => normalizeQuery(keyword).startsWith(query))) return 70;
  if (label.includes(query)) return 50;
  if (command.keywords.some((keyword) => normalizeQuery(keyword).includes(query))) return 30;
  return -1;
}

function normalizeQuery(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function isInsideFrontmatter(source: string, lineStart: number): boolean {
  if (!/^\uFEFF?---(?:\r?\n|$)/.test(source)) return false;
  const beforeLine = source.slice(0, lineStart);
  const lines = beforeLine.split(/\r?\n/);
  return !lines.slice(1).some((line) => /^(?:---|\.\.\.)[ \t]*$/.test(line));
}

function isInsideCodeFence(source: string, lineStart: number): boolean {
  const lines = source.slice(0, lineStart).split(/\r?\n/);
  let fence: { marker: "`" | "~"; size: number } | null = null;

  for (const line of lines) {
    const match = /^[ \t]{0,3}(`{3,}|~{3,})/.exec(line);
    if (!match) continue;
    const token = match[1] ?? "";
    const marker = token[0] as "`" | "~";
    if (!fence) fence = { marker, size: token.length };
    else if (fence.marker === marker && token.length >= fence.size) fence = null;
  }

  return fence !== null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
