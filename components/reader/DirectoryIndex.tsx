import Link from "next/link";
import { ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import type { ContentDirNode } from "@/lib/content-source";
import { formatDate } from "@/lib/format";

/**
 * Index page rendered when the user lands on a directory node (either a
 * stand-alone dir without an `_index.md` file, or the root). Lists the
 * directory's children as calm borderless rows: a bare icon, the title, an
 * optional one-line description, and a right-aligned meta (entry count for
 * folders, date for files) with a chevron that slides in on hover.
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
        <div className="v-empty">
          <span className="v-empty-icon" aria-hidden>
            <FolderOpen />
          </span>
          <strong className="v-empty-title">No documents here yet</strong>
          <p className="v-empty-text">
            Connect a Markdown or MDX folder to add documents to this section.
          </p>
          <Link href="/integrations" className="v-btn v-btn--sm">
            Manage sources
          </Link>
        </div>
      ) : (
        <ul className="dir-index">
          {visible.map((child) => {
            const Icon = child.type === "dir" ? Folder : FileText;
            let desc: string | null;
            let meta: string | null;
            let dateISO: string | null = null;
            if (child.type === "dir") {
              desc = child.index?.description ?? null;
              const count = child.children.filter((c) => !c.hidden).length;
              meta = `${count} ${count === 1 ? "entry" : "entries"}`;
            } else {
              desc = child.description ?? null;
              dateISO = child.date ?? null;
              meta = dateISO ? formatDate(dateISO) : null;
            }
            return (
              <li key={child.slug.join("/")} className="dir-index-item">
                <Link href={child.href} className="dir-index-card">
                  <span className="dir-index-icon" aria-hidden>
                    <Icon />
                  </span>
                  <span className="dir-index-body">
                    <span className="dir-index-title">{child.title}</span>
                    {desc ? <span className="dir-index-desc">{desc}</span> : null}
                  </span>
                  <span className="dir-index-meta">
                    {meta ? (
                      dateISO ? (
                        <time className="dir-index-count" dateTime={dateISO}>
                          {meta}
                        </time>
                      ) : (
                        <span className="dir-index-count">{meta}</span>
                      )
                    ) : null}
                    <ChevronRight className="dir-index-chev" aria-hidden />
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
