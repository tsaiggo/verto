import Link from "next/link";
import { FileText, Folder } from "lucide-react";
import type { ContentDirNode, ContentNode } from "@/lib/content-source";
import { formatDate } from "@/lib/format";

function childSubtitle(child: ContentNode): string | null {
  if (child.type === "file") {
    return child.description ?? null;
  }
  // Directory: prefer its index file's description, else a visible-child count.
  if (child.index?.description) return child.index.description;
  const count = child.children.filter((c) => !c.hidden).length;
  return `${count} ${count === 1 ? "entry" : "entries"}`;
}

/**
 * Index page rendered when the user lands on a directory node (either a
 * stand-alone dir without an `_index.md` file, or the root). Lists the
 * directory's children as tidy cards: an icon, the title, a one-line
 * subtitle (description for files, index description or child count for
 * folders), and an optional date.
 */
export default function DirectoryIndex({ node }: { node: ContentDirNode }) {
  const visible = node.children.filter((c) => !c.hidden);
  return (
    <div>
      <h1 className="doc-title doc-title-compact">{node.title}</h1>
      <p className="doc-summary doc-summary-compact">
        {visible.length} {visible.length === 1 ? "entry" : "entries"} in this section.
      </p>

      {visible.length === 0 ? (
        <p className="text-text-muted" style={{ fontSize: 14 }}>
          No documents here yet.
        </p>
      ) : (
        <ul className="dir-index">
          {visible.map((child) => {
            const subtitle = childSubtitle(child);
            const Icon = child.type === "dir" ? Folder : FileText;
            return (
              <li key={child.slug.join("/")} className="dir-index-item">
                <Link href={child.href} className="dir-index-card">
                  <span className="dir-index-icon" aria-hidden>
                    <Icon />
                  </span>
                  <span className="dir-index-body">
                    <span className="dir-index-row">
                      <span className="dir-index-title">{child.title}</span>
                      {child.type === "file" && child.date ? (
                        <time className="dir-index-date" dateTime={child.date}>
                          {formatDate(child.date)}
                        </time>
                      ) : null}
                    </span>
                    {subtitle ? <span className="dir-index-desc">{subtitle}</span> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
