"use client";

import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronRight,
  File as FileIcon,
  Folder as FolderIcon,
} from "lucide-react";
import type {
  ContentDirNode,
  ContentFileNode,
  ContentNode,
} from "@/lib/content-source";

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
}

/**
 * Recursive file-system tree used inside the left application rail. Mirrors
 * the design's library tree: folder / file glyphs, a rotating chevron for
 * directories (native `<details>`), and an accent highlight on the current
 * document. The branch containing the current page opens by default.
 */
export default function FileTree({ root, pathname }: FileTreeProps) {
  return (
    <nav aria-label="Document tree" className="rail-tree">
      <TreeChildren nodes={root.children} pathname={pathname} depth={0} />
    </nav>
  );
}

interface ChildrenProps {
  nodes: ContentNode[];
  pathname: string;
  depth: number;
}

function TreeChildren({ nodes, pathname, depth }: ChildrenProps) {
  const visible = nodes.filter((n) => !n.hidden);
  if (visible.length === 0) return null;
  return (
    <ul className="rail-tree-list">
      {visible.map((n) =>
        n.type === "dir" ? (
          <DirItem
            key={"d:" + n.slug.join("/")}
            node={n}
            pathname={pathname}
            depth={depth}
          />
        ) : (
          <FileItem
            key={"f:" + n.slug.join("/")}
            node={n}
            pathname={pathname}
            depth={depth}
          />
        ),
      )}
    </ul>
  );
}

function indentPx(depth: number) {
  return 8 + depth * 14;
}

function DirItem({
  node,
  pathname,
  depth,
}: {
  node: ContentDirNode;
  pathname: string;
  depth: number;
}) {
  const prefix = "/read/" + node.slug.join("/");
  const isOnPath = pathname === prefix || pathname.startsWith(prefix + "/");
  const indexHref = node.index ? node.index.href : null;
  const indexActive = indexHref !== null && pathname === indexHref;
  const runtimeIndex = node.index?.runtime === true;
  const runtimeIndexHref = node.index ? runtimeFileHref(node.index) : null;

  return (
    <li>
      <details open={isOnPath || depth === 0}>
        <summary
          className={`rail-tree-row rail-tree-dir${
            indexActive ? " is-active" : ""
          }`}
          style={{ paddingLeft: indentPx(depth) }}
        >
          <ChevronRight className="rail-tree-chevron" aria-hidden />
          <FolderIcon className="rail-tree-icon" aria-hidden />
          {runtimeIndex && runtimeIndexHref ? (
            <Link
              href={runtimeIndexHref}
              onClick={(e) => e.stopPropagation()}
              className="rail-tree-label"
            >
              {node.title}
            </Link>
          ) : indexHref && !runtimeIndex ? (
            <Link
              href={indexHref}
              onClick={(e) => e.stopPropagation()}
              className="rail-tree-label"
            >
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
        <TreeChildren
          nodes={node.children}
          pathname={pathname}
          depth={depth + 1}
        />
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
          style={{ paddingLeft: indentPx(depth) + 14 }}
        >
          <FileIcon className="rail-tree-icon" aria-hidden />
          <span className="rail-tree-label">
            {node.title}
            {node.ext}
          </span>
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
          style={{ ...runtimeActionStyle, paddingLeft: indentPx(depth) + 14 }}
        >
          <FileIcon className="rail-tree-icon" aria-hidden />
          <span className="rail-tree-label">
            {node.title}
            {node.ext}
          </span>
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
        style={{ paddingLeft: indentPx(depth) + 14 }}
      >
        <FileIcon className="rail-tree-icon" aria-hidden />
        <span className="rail-tree-label">
          {node.title}
          {node.ext}
        </span>
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
  if (node.runtimeSource === "github") return `/runtime/github?${params.toString()}`;
  return null;
}

function notifyRuntimeReaderUnavailable(title: string) {
  toast("Runtime reader is not available yet", {
    description: `${title} was loaded after build time, so Verto cannot open it in this static desktop build yet.`,
  });
}
