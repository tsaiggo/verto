import type { ContentDirNode, ContentFileNode, ContentNode, RawFileEntry } from "./types";
import {
  compareNodes,
  ingest,
  isIndexFile,
  isReadable,
  makeScaffold,
  stripExt,
  titleFromFilename,
  type DirScaffold,
} from "./tree";

interface RuntimeTreeOptions {
  source?: "local" | "github";
}

function fileNode(
  entry: RawFileEntry,
  slug: string[],
  options: RuntimeTreeOptions
): ContentFileNode {
  const fileName = entry.path[entry.path.length - 1] ?? "";
  const { base, ext } = stripExt(fileName);
  return {
    type: "file",
    slug,
    href: "/read/" + slug.join("/"),
    title: titleFromFilename(base),
    mtime: entry.mtime ?? 0,
    id: entry.id,
    ext,
    runtime: true,
    runtimeSource: options.source,
    sha: entry.sha,
    size: entry.size,
    etag: entry.etag,
  };
}

function materialize(scaffold: DirScaffold, options: RuntimeTreeOptions): ContentDirNode {
  const children: ContentNode[] = [];
  let index: ContentFileNode | undefined;

  for (const entry of scaffold.files) {
    const fileName = entry.path[entry.path.length - 1] ?? "";
    const { base } = stripExt(fileName);
    if (isIndexFile(base) && scaffold.slug.length > 0) {
      index = fileNode(entry, scaffold.slug, options);
      continue;
    }
    children.push(fileNode(entry, [...scaffold.slug, base], options));
  }

  for (const sub of scaffold.subs.values()) {
    const dir = materialize(sub, options);
    if (dir.children.length === 0 && !dir.index) continue;
    children.push(dir);
  }

  children.sort(compareNodes);
  const dirName = scaffold.slug[scaffold.slug.length - 1] ?? "";

  return {
    type: "dir",
    slug: scaffold.slug,
    href: index ? index.href : "/read/" + scaffold.slug.join("/"),
    title: index?.title ?? (dirName ? titleFromFilename(dirName) : "Home"),
    index,
    children,
  };
}

export function buildRuntimeContentTree(
  entries: RawFileEntry[],
  options: RuntimeTreeOptions = {}
): ContentDirNode {
  const root = makeScaffold([]);
  for (const entry of entries) {
    const name = entry.path[entry.path.length - 1] ?? "";
    if (!isReadable(name)) continue;
    ingest(root, entry);
  }
  return materialize(root, options);
}
