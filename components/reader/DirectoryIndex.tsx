import Link from "next/link";
import type { ContentDirNode } from "@/lib/content-source";
import { formatDate } from "@/lib/format";
import EmptyBox from "@/components/illustrations/EmptyBox";

/**
 * Index page rendered when the user lands on a directory node (either a
 * stand-alone dir without an `_index.md` file, or the root). Lists the
 * directory's children.
 */
export default function DirectoryIndex({ node }: { node: ContentDirNode }) {
  const visible = node.children.filter((c) => !c.hidden);
  return (
    <div>
      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.4px",
          marginBottom: 8,
        }}
      >
        {node.title}
      </h1>
      <p
        className="text-text-muted"
        style={{ fontSize: 15, marginBottom: 24 }}
      >
        {visible.length} {visible.length === 1 ? "entry" : "entries"} in this
        section.
      </p>

      {visible.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center text-center"
          style={{ padding: "32px 16px" }}
        >
          <EmptyBox
            aria-hidden="true"
            className="text-text-muted"
            style={{ width: 160, height: "auto", opacity: 0.8 }}
          />
          <p
            className="text-text-muted"
            style={{ fontSize: 14, marginTop: 12 }}
          >
            No documents here yet.
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {visible.map((child) => (
            <li key={child.slug.join("/")} style={{ marginBottom: 12 }}>
              <Link
                href={child.href}
                className="block rounded-lg border border-border no-underline transition-colors hover:bg-bg-muted"
                style={{
                  padding: "14px 18px",
                  borderRadius: "var(--radius)",
                }}
              >
                <div
                  className="text-text"
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    letterSpacing: "-0.2px",
                    marginBottom: 4,
                  }}
                >
                  {child.type === "dir" ? "📁 " : ""}
                  {child.title}
                </div>
                {child.type === "file" && child.description && (
                  <p
                    className="text-text-muted"
                    style={{
                      fontSize: 13.5,
                      lineHeight: 1.55,
                      margin: 0,
                    }}
                  >
                    {child.description}
                  </p>
                )}
                {child.type === "file" && child.date && (
                  <time
                    className="text-text-light"
                    style={{
                      fontSize: 12,
                      marginTop: 6,
                      display: "block",
                    }}
                    dateTime={child.date}
                  >
                    {formatDate(child.date)}
                  </time>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
