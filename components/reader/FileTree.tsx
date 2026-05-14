import Link from "next/link";
import type { ContentDirNode, ContentFileNode, ContentNode } from "@/lib/content-source";

interface FileTreeProps {
  root: ContentDirNode;
  pathname: string;
}

/**
 * Recursive file-system style sidebar. Directories collapse using native
 * `<details>`; the branch containing the current document opens by default.
 *
 * Renders nothing for hidden nodes.
 */
export default function FileTree({ root, pathname }: FileTreeProps) {
  return (
    <aside
      className="hidden lg:block shrink-0 sticky overflow-y-auto overflow-x-hidden border-r border-border"
      style={{
        width: "var(--nav-w)",
        top: "var(--navbar-h)",
        height: "calc(100vh - var(--navbar-h))",
        padding: "16px 0 40px",
        scrollbarWidth: "thin",
        scrollbarColor: "var(--border) transparent",
      }}
    >
      <nav aria-label="Document tree">
        <TreeChildren nodes={root.children} pathname={pathname} depth={0} />
      </nav>
    </aside>
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
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
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
  return 12 + depth * 12;
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

  return (
    <li>
      <details open={isOnPath || depth === 0}>
        <summary
          className="flex items-center cursor-pointer select-none rounded-md mx-2 list-none transition-colors hover:bg-bg-muted [&::-webkit-details-marker]:hidden"
          style={{
            padding: "5px 12px",
            paddingLeft: indentPx(depth),
            fontSize: depth === 0 ? "11.5px" : "13px",
            fontWeight: depth === 0 ? 600 : 500,
            textTransform: depth === 0 ? "uppercase" : "none",
            letterSpacing: depth === 0 ? "0.06em" : "normal",
            color: indexActive ? "var(--accent-blue)" : "var(--text-muted)",
            gap: 6,
          }}
        >
          <Chevron />
          {indexHref ? (
            <Link
              href={indexHref}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 no-underline"
              style={{
                color: "inherit",
                textDecoration: "none",
              }}
            >
              {node.title}
            </Link>
          ) : (
            <span className="flex-1">{node.title}</span>
          )}
        </summary>

        <div style={{ padding: "2px 0 4px" }}>
          <TreeChildren
            nodes={node.children}
            pathname={pathname}
            depth={depth + 1}
          />
        </div>
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
  return (
    <li>
      <Link
        href={node.href}
        className={`relative block rounded-md mx-2 no-underline transition-colors ${
          isActive
            ? "bg-bg-muted text-accent-blue font-semibold"
            : "text-text-muted hover:bg-bg-muted hover:text-text"
        }`}
        style={{
          padding: "5px 12px",
          paddingLeft: indentPx(depth) + 12,
          fontSize: "13.5px",
          lineHeight: 1.45,
        }}
      >
        {isActive && (
          <span
            className="absolute rounded-sm"
            style={{
              left: 4,
              top: "50%",
              transform: "translateY(-50%)",
              width: "3px",
              height: "14px",
              background: "var(--accent-blue)",
            }}
          />
        )}
        {node.title}
      </Link>
    </li>
  );
}

function Chevron() {
  return (
    <svg
      className="chevron shrink-0 transition-transform duration-200"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
