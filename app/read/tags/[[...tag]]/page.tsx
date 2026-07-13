import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listAllFiles } from "@/lib/content-source";
import DocumentList from "@/components/reader/DocumentList";
import { Tag } from "lucide-react";

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

/**
 * Pre-render a static page for every real tag that appears in readable
 * frontmatter, plus the bare `/read/tags` root needed for static export.
 */
export async function generateStaticParams() {
  const files = await listAllFiles();
  const tags = new Set<string>();
  for (const f of files) {
    if (f.hidden || f.draft || !f.tags) continue;
    for (const tag of f.tags) tags.add(tag);
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
  const visibleMatches = files.filter(
    (file) => !file.hidden && !file.draft && file.tags?.includes(decoded)
  );

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
          {visibleMatches.length > 0 ? (
            <DocumentList files={visibleMatches} />
          ) : (
            <div className="v-empty">
              <span className="v-empty-icon" aria-hidden>
                <Tag />
              </span>
              <strong className="v-empty-title">No documents use this tag</strong>
              <p className="v-empty-text">
                Try another tag or browse the documents in your library.
              </p>
              <Link href="/library" className="v-btn v-btn--sm">
                Browse library
              </Link>
            </div>
          )}
        </div>
      </section>
      <aside className="toc-sidebar" />
    </>
  );
}
