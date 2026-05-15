import Link from "next/link";
import {
  getContentTree,
  listAllFiles,
  type ContentNode,
  type ContentDirNode,
  type ContentFileNode,
} from "@/lib/content-source";
import { formatDate } from "@/lib/format";
import ReadingPerson from "@/components/illustrations/ReadingPerson";

export default async function HomePage() {
  const root = await getContentTree();
  const allFiles = await listAllFiles();

  // Top-level visible nodes — used for the "Sections" grid
  const topLevel = root.children.filter((n) => !n.hidden);

  // Recently updated files (by mtime) — first 5
  const recent = [...allFiles]
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 5);

  return (
    <div
      className="mx-auto w-full"
      style={{ maxWidth: 920, padding: "60px 24px 80px" }}
    >
      <header style={{ marginBottom: 40 }}>
        <div
          className="flex flex-col-reverse items-start gap-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              className="font-bold tracking-tight text-text"
              style={{
                fontSize: "clamp(36px, 6vw, 52px)",
                letterSpacing: "-1px",
                lineHeight: 1.1,
              }}
            >
              Verto
            </h1>
            <p
              className="text-text-muted"
              style={{ fontSize: 18, marginTop: 12, letterSpacing: "-0.2px" }}
            >
              A reader for your Markdown and MDX library.
            </p>
            <div
              className="flex flex-wrap items-center gap-3"
              style={{ marginTop: 24 }}
            >
              <Link
                href="/read"
                className="inline-flex items-center justify-center font-medium text-white no-underline transition-opacity duration-150 hover:opacity-90"
                style={{
                  background: "var(--accent-blue)",
                  padding: "10px 24px",
                  borderRadius: "var(--radius)",
                  fontSize: 14,
                }}
              >
                Browse library
              </Link>
              <span
                className="text-text-light"
                style={{ fontSize: 13 }}
              >
                {allFiles.length} document{allFiles.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <ReadingPerson
            aria-hidden="true"
            className="text-text shrink-0"
            style={{ width: 140, height: "auto", opacity: 0.85 }}
          />
        </div>
      </header>

      {topLevel.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <h2
            className="font-semibold text-text"
            style={{
              fontSize: 13,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 16,
              color: "var(--text-muted)",
            }}
          >
            Sections
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            {topLevel.map((node) => (
              <SectionCard key={node.slug.join("/")} node={node} />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <h2
            className="font-semibold text-text"
            style={{
              fontSize: 13,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 16,
              color: "var(--text-muted)",
            }}
          >
            Recently Updated
          </h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {recent.map((file) => (
              <li key={file.slug.join("/")} style={{ marginBottom: 10 }}>
                <RecentItem file={file} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SectionCard({ node }: { node: ContentNode }) {
  const isDir = node.type === "dir";
  const count = isDir
    ? (node as ContentDirNode).children.filter((c) => !c.hidden).length
    : 0;
  return (
    <Link
      href={node.href}
      className="block rounded-lg border border-border no-underline transition-colors hover:bg-bg-muted"
      style={{ padding: "14px 16px", borderRadius: "var(--radius)" }}
    >
      <div
        className="text-text"
        style={{
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: "-0.2px",
          marginBottom: 4,
        }}
      >
        {isDir ? "📁 " : "📄 "}
        {node.title}
      </div>
      {isDir && (
        <div
          className="text-text-muted"
          style={{ fontSize: 12 }}
        >
          {count} {count === 1 ? "entry" : "entries"}
        </div>
      )}
    </Link>
  );
}

function RecentItem({ file }: { file: ContentFileNode }) {
  return (
    <Link
      href={file.href}
      className="flex items-baseline justify-between gap-3 rounded-md no-underline transition-colors hover:bg-bg-muted"
      style={{ padding: "8px 12px" }}
    >
      <span
        className="text-text"
        style={{ fontSize: 14, fontWeight: 500 }}
      >
        {file.title}
      </span>
      <time
        className="text-text-light"
        style={{ fontSize: 12, whiteSpace: "nowrap" }}
        dateTime={new Date(file.mtime).toISOString()}
      >
        {formatDate(new Date(file.mtime).toISOString())}
      </time>
    </Link>
  );
}
