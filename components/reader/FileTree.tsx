"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import type { ContentDirNode, ContentFileNode, ContentNode } from "@/lib/content-source";

const runtimeActionStyle = {
  background: "transparent",
  border: 0,
  color: "inherit",
  font: "inherit",
  textAlign: "left",
} as const;

interface FileTreeProps {
  root: ContentDirNode;
  pathname: string;
  /** Optional case-insensitive filter applied to file / folder names. */
  query?: string;
}

/**
 * Recursive file-system tree used inside the left application rail. Styled as a
 * calm Notion-style outline rather than an IDE explorer: directories show only
 * a rotating chevron (native `<details>`), files sit under a faint dot marker,
 * nested levels are traced by a hairline indent guide, and file extensions are
 * dimmed so titles read first. The branch containing the current page opens by
 * default; the current document is highlighted in ink.
 *
 * When `query` is set, only nodes whose name (or a descendant's name) matches
 * are shown, and matching folders are forced open so hits stay visible.
 */
export default function FileTree({ root, pathname, query }: FileTreeProps) {
  const q = query?.trim().toLowerCase() ?? "";
  return (
    <nav aria-label="Document tree" className="rail-tree">
      <TreeChildren nodes={root.children} pathname={pathname} depth={0} query={q} />
    </nav>
  );
}

interface ChildrenProps {
  nodes: ContentNode[];
  pathname: string;
  depth: number;
  query: string;
}

/** True when the node, or any descendant, matches the filter query. */
function nodeMatchesQuery(node: ContentNode, q: string): boolean {
  if (!q) return true;
  const label = (node.title + (node.type === "file" ? node.ext : "")).toLowerCase();
  if (label.includes(q)) return true;
  if (node.type === "dir") return node.children.some((c) => nodeMatchesQuery(c, q));
  return false;
}

function TreeChildren({ nodes, pathname, depth, query }: ChildrenProps) {
  const visible = nodes.filter((n) => !n.hidden && nodeMatchesQuery(n, query));
  if (visible.length === 0) return null;
  const nested = depth > 0;
  return (
    <ul
      className={nested ? "rail-tree-list is-nested" : "rail-tree-list"}
      style={nested ? ({ "--tree-depth": depth } as CSSProperties) : undefined}
    >
      {visible.map((n) =>
        n.type === "dir" ? (
          <DirItem
            key={"d:" + n.slug.join("/")}
            node={n}
            pathname={pathname}
            depth={depth}
            query={query}
          />
        ) : (
          <FileItem key={"f:" + n.slug.join("/")} node={n} pathname={pathname} depth={depth} />
        )
      )}
    </ul>
  );
}

function indentPx(depth: number) {
  return 10 + depth * 16;
}

/** File title with a dimmed extension so the name reads first. */
function FileLabel({ node }: { node: ContentFileNode }) {
  return (
    <span className="rail-tree-label">
      {node.title}
      <span className="rail-tree-ext">{node.ext}</span>
    </span>
  );
}

function DirItem({
  node,
  pathname,
  depth,
  query,
}: {
  node: ContentDirNode;
  pathname: string;
  depth: number;
  query: string;
}) {
  const prefix = "/read/" + node.slug.join("/");
  const isOnPath = pathname === prefix || pathname.startsWith(prefix + "/");
  const indexHref = node.index ? node.index.href : null;
  const indexActive = indexHref !== null && pathname === indexHref;
  const runtimeIndex = node.index?.runtime === true;
  const runtimeIndexHref = node.index ? runtimeFileHref(node.index) : null;

  return (
    <li>
      <details open={query ? true : isOnPath || depth === 0}>
        <summary
          className={`rail-tree-row rail-tree-dir${indexActive ? " is-active" : ""}`}
          style={{ paddingLeft: indentPx(depth) }}
        >
          <ChevronRight className="rail-tree-chevron" aria-hidden />
          {runtimeIndex && runtimeIndexHref ? (
            <Link
              href={runtimeIndexHref}
              onClick={(e) => e.stopPropagation()}
              className="rail-tree-label"
            >
              {node.title}
            </Link>
          ) : indexHref && !runtimeIndex ? (
            <Link href={indexHref} onClick={(e) => e.stopPropagation()} className="rail-tree-label">
              {node.title}
            </Link>
          ) : runtimeIndex ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                notifyRuntimeReaderUnavailable(node.title);
              }}
              className="rail-tree-label rail-tree-runtime-action"
              style={runtimeActionStyle}
            >
              {node.title}
            </button>
          ) : (
            <span className="rail-tree-label">{node.title}</span>
          )}
        </summary>
        <TreeChildren nodes={node.children} pathname={pathname} depth={depth + 1} query={query} />
      </details>
    </li>
  );
}

function FileItem({
  node,
  pathname,
  depth,
}: {
  node: ContentFileNode;
  pathname: string;
  depth: number;
}) {
  const isActive = pathname === node.href;
  const runtimeHref = runtimeFileHref(node);
  if (node.runtime && runtimeHref) {
    return (
      <li>
        <Link
          href={runtimeHref}
          className="rail-tree-row rail-tree-file"
          style={{ paddingLeft: indentPx(depth) }}
        >
          <span className="rail-tree-lead" aria-hidden />
          <FileLabel node={node} />
        </Link>
      </li>
    );
  }

  if (node.runtime) {
    return (
      <li>
        <button
          type="button"
          onClick={() => notifyRuntimeReaderUnavailable(node.title)}
          className="rail-tree-row rail-tree-file rail-tree-runtime-action"
          style={{ ...runtimeActionStyle, paddingLeft: indentPx(depth) }}
        >
          <span className="rail-tree-lead" aria-hidden />
          <FileLabel node={node} />
        </button>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={node.href}
        aria-current={isActive ? "page" : undefined}
        className={`rail-tree-row rail-tree-file${isActive ? " is-active" : ""}`}
        style={{ paddingLeft: indentPx(depth) }}
      >
        <span className="rail-tree-lead" aria-hidden />
        <FileLabel node={node} />
      </Link>
    </li>
  );
}

function runtimeFileHref(node: ContentFileNode): string | null {
  if (!node.runtime) return null;
  const params = new URLSearchParams({
    file: node.id,
    title: node.title,
    ext: node.ext,
  });
  if (node.runtimeSource === "local") return `/runtime/local?${params.toString()}`;
  return null;
}

function notifyRuntimeReaderUnavailable(title: string) {
  toast("Runtime reader is not available yet", {
    description: `${title} was loaded after build time, so Verto cannot open it in this static desktop build yet.`,
  });
}
