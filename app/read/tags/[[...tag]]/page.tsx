import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listAllFiles } from "@/lib/content-source";
import type { ContentFileNode } from "@/lib/content-source";
import DocumentList from "@/components/reader/DocumentList";
import { SAMPLE_DOCS } from "@/components/pages/sample";

interface TagPageProps {
  params: Promise<{ tag?: string[] }>;
}

/**
 * Optional catch-all (`[[...tag]]`) so the Library tag view stays compatible
 * with `output: export` (the desktop/Tauri build). A required `[tag]` segment
 * forces `generateStaticParams()` to emit one entry per tag; when the content
 * source has no tagged files that list is empty, and Next.js then rejects the
 * route for static export with a misleading "missing generateStaticParams()"
 * error — internally an empty array is read as "zero prerendered routes". An
 * optional catch-all lets us always seed the bare `/read/tags` param
 * (`{ tag: [] }`), so there is always at least one route to export. Only
 * single-segment tag URLs render a page; the bare root and any deeper path
 * 404 via `notFound()`, preserving the original `/read/tags/<tag>`-only
 * behavior.
 */
export const dynamicParams = false;

function sampleMatches(tag: string): ContentFileNode[] {
  const normalized = tag.toLowerCase();
  const preferred = SAMPLE_DOCS.filter((doc) =>
    doc.tags.some((candidate) => candidate.toLowerCase() === normalized)
  );
  const docs = preferred.length > 0 ? preferred : SAMPLE_DOCS.slice(0, 6);
  return docs.map((doc, index) => ({
    type: "file",
    slug: ["sample", doc.file.replace(/\.(mdx?|html)$/i, "")],
    href: doc.href,
    title: doc.title,
    description: doc.excerpt,
    date: new Date(Date.now() - index * 86_400_000).toISOString(),
    tags: Array.from(new Set([...doc.tags, normalized])),
    status: "published",
    mtime: Date.now() - index * 86_400_000,
    id: `sample-tag:${normalized}:${doc.file}`,
    ext: doc.file.endsWith(".mdx") ? ".mdx" : ".md",
  }));
}

/**
 * Pre-render a static page for every tag that appears at least once in the
 * frontmatter of any file, plus the bare `/read/tags` root. Tags are
 * case-sensitive and normalized only via URL encoding.
 */
export async function generateStaticParams() {
  const files = await listAllFiles();
  const tags = new Set<string>([
    "agent",
    "ai",
    "design",
    "engineering",
    "product",
    "research",
    "workflows",
  ]);
  for (const f of files) {
    if (f.tags) for (const t of f.tags) tags.add(t);
  }
  // Always include the bare `/read/tags` root (`{ tag: [] }`) so the param
  // set is never empty — required for `output: export` (see above).
  return [{ tag: [] as string[] }, ...Array.from(tags).map((tag) => ({ tag: [tag] }))];
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { tag } = await params;
  const segs = tag ?? [];
  if (segs.length !== 1) return { title: "Not Found" };
  const decoded = decodeURIComponent(segs[0]);
  return {
    title: `Tag: ${decoded}`,
    description: `Documents tagged "${decoded}"`,
  };
}

export default async function TagPage({ params }: TagPageProps) {
  const { tag } = await params;
  const segs = tag ?? [];
  // Only `/read/tags/<tag>` is a real page; the bare root and any deeper path
  // fall through to 404 — this preserves the original required-`[tag]`
  // behavior while keeping the route exportable for empty content sources.
  if (segs.length !== 1) notFound();
  let decoded: string;
  try {
    decoded = decodeURIComponent(segs[0]);
  } catch {
    // Malformed percent-encoding — treat as a missing tag rather than crash
    notFound();
  }
  const files = await listAllFiles();
  const matches = files.filter((f) => f.tags?.includes(decoded));
  const visibleMatches = matches.length > 0 ? matches : sampleMatches(decoded);

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
            {visibleMatches.length} {visibleMatches.length === 1 ? "document" : "documents"}
          </p>
          <DocumentList files={visibleMatches} />
        </div>
      </section>
      <aside className="toc-sidebar" />
    </>
  );
}
