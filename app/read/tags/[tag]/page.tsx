import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listAllFiles } from "@/lib/content-source";
import { formatDate } from "@/lib/format";

interface TagPageProps {
  params: Promise<{ tag: string }>;
}

/**
 * Pre-render a static page for every tag that appears at least once in the
 * frontmatter of any file. Tags are case-sensitive and normalized only via
 * URL encoding.
 */
export async function generateStaticParams() {
  const files = await listAllFiles();
  const tags = new Set<string>();
  for (const f of files) {
    if (f.tags) for (const t of f.tags) tags.add(t);
  }
  return Array.from(tags).map((tag) => ({ tag }));
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  return {
    title: `Tag: ${decoded}`,
    description: `Documents tagged "${decoded}"`,
  };
}

export default async function TagPage({ params }: TagPageProps) {
  const { tag } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(tag);
  } catch {
    // Malformed percent-encoding — treat as a missing tag rather than crash
    notFound();
  }
  const files = await listAllFiles();
  const matches = files.filter((f) => f.tags?.includes(decoded));
  if (matches.length === 0) notFound();

  return (
    <>
      <section className="main" aria-label="Tagged documents">
        <div className="content-wrap prose">
          <p className="doc-kicker">
            <Link href="/read" className="doc-kicker-link">
              ← All documents
            </Link>
          </p>
          <h1 className="doc-title">
            Tag: <span className="doc-title-accent">{decoded}</span>
          </h1>
          <p className="doc-summary">
            {matches.length} {matches.length === 1 ? "document" : "documents"}
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {matches.map((f) => (
              <li key={f.href} style={{ marginBottom: 20 }}>
                <Link
                  href={f.href}
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    textDecoration: "none",
                    color: "var(--text)",
                  }}
                >
                  {f.title}
                </Link>
                {f.description && (
                  <p
                    className="text-text-muted"
                    style={{ fontSize: 14, margin: "4px 0 0", lineHeight: 1.55 }}
                  >
                    {f.description}
                  </p>
                )}
                <p className="text-text-light" style={{ fontSize: 12, margin: "4px 0 0" }}>
                  {f.date
                    ? formatDate(f.date)
                    : `Updated ${formatDate(new Date(f.mtime).toISOString())}`}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <aside className="toc-sidebar" />
    </>
  );
}
