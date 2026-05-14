import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getAllReadableSlugs,
  getNodeBySlug,
  getPrevNext,
} from "@/lib/content-source";
import { getDocumentBySlug } from "@/lib/mdx";
import TableOfContents from "@/components/layout/TableOfContents";
import InlineCommentProvider from "@/components/mdx/InlineCommentProvider";
import Breadcrumb from "@/components/reader/Breadcrumb";
import PrevNext from "@/components/reader/PrevNext";
import DirectoryIndex from "@/components/reader/DirectoryIndex";
import { formatDate } from "@/lib/format";

interface ReadPageProps {
  params: Promise<{ path?: string[] }>;
}

export async function generateStaticParams() {
  const slugs = await getAllReadableSlugs();
  // Include the root (`/read`) so it's pre-rendered too
  return [{ path: [] }, ...slugs.map((slug) => ({ path: slug }))];
}

export async function generateMetadata({
  params,
}: ReadPageProps): Promise<Metadata> {
  const { path } = await params;
  const slug = path ?? [];
  const node = await getNodeBySlug(slug);
  if (!node) return { title: "Not Found" };
  const description =
    node.type === "file" ? node.description : `Index of ${node.title}`;
  return { title: node.title, description };
}

export default async function ReadPage({ params }: ReadPageProps) {
  const { path } = await params;
  const slug = path ?? [];

  const node = await getNodeBySlug(slug);
  if (!node) notFound();

  // Build breadcrumb titles by resolving each prefix
  const titles: string[] = [];
  for (let i = 0; i < slug.length; i++) {
    const prefix = slug.slice(0, i + 1);
    const n = await getNodeBySlug(prefix);
    titles.push(n?.title ?? prefix[prefix.length - 1]);
  }

  // Directory without an index → render auto index page
  if (node.type === "dir" && !node.index) {
    return (
      <>
        <main className="main">
          <div className="content-wrap prose">
            <Breadcrumb slug={slug} titles={titles} />
            <DirectoryIndex node={node} />
          </div>
        </main>
        <aside className="toc-sidebar" />
      </>
    );
  }

  // File (or directory with an index file)
  const targetSlug = node.type === "file" ? node.slug : node.index!.slug;
  const doc = await getDocumentBySlug(targetSlug);
  if (!doc) notFound();

  const [prev, next] = await getPrevNext(targetSlug);
  const file = doc.node;

  return (
    <>
      <main className="main">
        <div className="content-wrap prose">
          <InlineCommentProvider>
            <Breadcrumb slug={slug} titles={titles} />
            <header style={{ marginBottom: 24 }}>
              <h1
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: "-0.4px",
                  marginBottom: 8,
                }}
              >
                {file.title}
              </h1>
              <FileMeta
                date={file.date}
                author={file.author}
                tags={file.tags}
                mtime={file.mtime}
              />
            </header>
            {doc.content}
            <PrevNext prev={prev} next={next} />
          </InlineCommentProvider>
        </div>
      </main>
      <aside className="toc-sidebar">
        <TableOfContents items={doc.toc} />
      </aside>
    </>
  );
}

function FileMeta({
  date,
  author,
  tags,
  mtime,
}: {
  date?: string;
  author?: string;
  tags?: string[];
  mtime: number;
}) {
  const hasMeta = date || author || (tags && tags.length > 0);
  if (!hasMeta) {
    // Fall back to file modification time so readers always see *something*
    return (
      <div
        className="text-text-light"
        style={{ fontSize: 13 }}
      >
        Updated {formatDate(new Date(mtime).toISOString())}
      </div>
    );
  }
  return (
    <div
      className="text-text-muted"
      style={{
        fontSize: 13,
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
      }}
    >
      {date && <time dateTime={date}>{formatDate(date)}</time>}
      {author && <span>{author}</span>}
      {tags && tags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 12,
                padding: "2px 8px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
