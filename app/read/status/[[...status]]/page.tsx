import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listAllFiles } from "@/lib/content-source";
import type { ContentFileNode } from "@/lib/content-source";
import DocumentList from "@/components/reader/DocumentList";
import { SAMPLE_DOCS } from "@/components/pages/sample";

interface StatusPageProps {
  params: Promise<{ status?: string[] }>;
}

export const dynamicParams = false;

function sampleMatches(status: string): ContentFileNode[] {
  const normalized = status.toLowerCase();
  return SAMPLE_DOCS.slice(0, 6).map((doc, index) => ({
    type: "file",
    slug: ["sample", doc.file.replace(/\.(mdx?|html)$/i, "")],
    href: doc.href,
    title: doc.title,
    description: doc.excerpt,
    date: new Date(Date.now() - index * 86_400_000).toISOString(),
    tags: doc.tags,
    status: normalized,
    mtime: Date.now() - index * 86_400_000,
    id: `sample-status:${normalized}:${doc.file}`,
    ext: doc.file.endsWith(".mdx") ? ".mdx" : ".md",
  }));
}

export async function generateStaticParams() {
  const files = await listAllFiles();
  const statuses = new Set<string>(["unread", "reading", "draft", "archived"]);
  for (const file of files) {
    if (file.status) statuses.add(file.status);
  }
  return [
    { status: [] as string[] },
    ...Array.from(statuses).map((status) => ({ status: [status] })),
  ];
}

export async function generateMetadata({ params }: StatusPageProps): Promise<Metadata> {
  const { status } = await params;
  const segs = status ?? [];
  if (segs.length !== 1) return { title: "Not Found" };
  const decoded = decodeURIComponent(segs[0]);
  return {
    title: `Status: ${decoded}`,
    description: `Documents with status "${decoded}"`,
  };
}

export default async function StatusPage({ params }: StatusPageProps) {
  const { status } = await params;
  const segs = status ?? [];
  if (segs.length !== 1) notFound();

  let decoded: string;
  try {
    decoded = decodeURIComponent(segs[0]);
  } catch {
    notFound();
  }

  const files = await listAllFiles();
  const matches = files.filter((file) => file.status === decoded);
  const visibleMatches = matches.length > 0 ? matches : sampleMatches(decoded);

  return (
    <>
      <section className="main" aria-label="Status documents">
        <div className="content-wrap prose">
          <p className="doc-kicker">
            <Link href="/read" className="doc-kicker-link">
              ← All documents
            </Link>
          </p>
          <h1 className="doc-title">
            Status: <span className="doc-title-accent">{decoded}</span>
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
