/** Metadata is data only; source modules and YAML constructors never execute. */
export function sourceMetadata(source: string, fallback: string) {
  const frontmatter = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)?.[1] ?? "";
  const value = (name: string) =>
    new RegExp(`^${name}:\\s*(.+)$`, "m").exec(frontmatter)?.[1]?.trim();
  const title =
    value("title")?.replace(/^(['"])(.*)\1$/, "$2") ||
    /^#\s+(.+)$/m.exec(source)?.[1] ||
    fallback.replace(/\.mdx?$/i, "");
  const tags = (value("tags") ?? "")
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((tag) => tag.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
  const boolean = (name: string) => /^(?:true|yes|on)(?:\s+#.*)?$/i.test(value(name) ?? "");
  return {
    title: title.slice(0, 300),
    tags: tags.slice(0, 20).map((tag) => tag.slice(0, 80)),
    draft: boolean("draft"),
    hidden: boolean("hidden"),
  };
}
