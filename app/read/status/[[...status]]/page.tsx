import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listAllFiles } from "@/lib/content-source";
import { formatDate } from "@/lib/format";

interface StatusPageProps {
  params: Promise<{ status?: string[] }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  const files = await listAllFiles();
  const statuses = new Set<string>();
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
  if (matches.length === 0) notFound();

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
            {matches.length} {matches.length === 1 ? "document" : "documents"}
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {matches.map((file) => (
              <li key={file.href} style={{ marginBottom: 20 }}>
                <Link
                  href={file.href}
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    textDecoration: "none",
                    color: "var(--text)",
                  }}
                >
                  {file.title}
                </Link>
                {file.description && (
                  <p
                    className="text-text-muted"
                    style={{ fontSize: 14, margin: "4px 0 0", lineHeight: 1.55 }}
                  >
                    {file.description}
                  </p>
                )}
                <p className="text-text-light" style={{ fontSize: 12, margin: "4px 0 0" }}>
                  {file.date
                    ? formatDate(file.date)
                    : `Updated ${formatDate(new Date(file.mtime).toISOString())}`}
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
