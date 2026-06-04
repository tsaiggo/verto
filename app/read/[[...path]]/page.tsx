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
import PrevNext from "@/components/reader/PrevNext";
import DirectoryIndex from "@/components/reader/DirectoryIndex";
import ReadingStateTracker from "@/components/reader/ReadingStateTracker";
import RightRailPanels from "@/components/reader/RightRailPanels";
import { getSourceInfo } from "@/lib/source-info";
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

  // Top-level section name, shown as a category badge above the title.
  const category = titles[0];
  const source = getSourceInfo();

  // Directory without an index → render auto index page
  if (node.type === "dir" && !node.index) {
    return (
      <>
        <main className="main">
          <div className="content-wrap prose">
            <DirectoryIndex node={node} />
          </div>
        </main>
        <aside className="toc-sidebar">
          <RightRailPanels source={source} />
        </aside>
      </>
    );
  }

  // File (or directory with an index file). The directory-without-index
  // case was handled above, so when we reach this branch and `node.type`
  // is "dir", `node.index` is guaranteed to be defined.
  const targetSlug =
    node.type === "file" ? node.slug : node.index!.slug;
  const doc = await getDocumentBySlug(targetSlug);
  if (!doc) notFound();

  const [prev, next] = await getPrevNext(targetSlug);
  const file = doc.node;

  return (
    <>
      <main className="main">
        <article className="content-wrap prose" lang={file.lang}>
          <ReadingStateTracker
            href={file.href}
            slug={file.slug}
            title={file.title}
            path={`${file.slug.join("/")}${file.ext}`}
          />
          <InlineCommentProvider>
            {file.cover && (
              <div className="article-cover">
                {/* Static cover image — use plain <img> so the path can be a
                    remote URL or a relative content path without configuring
                    Next's image optimizer per source. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file.cover} alt="" loading="lazy" />
              </div>
            )}
            <header style={{ marginBottom: 24 }}>
              {category && (
                <span className="doc-category" aria-label="Section">
                  {category}
                </span>
              )}
              {file.draft && (
                <span className="draft-badge" aria-label="Draft document">
                  Draft
                </span>
              )}
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
                updated={file.updated}
              />
            </header>
            {doc.content}
            <PrevNext prev={prev} next={next} />
          </InlineCommentProvider>
        </article>
      </main>
      <aside className="toc-sidebar">
        <div className="rail-panel toc-panel">
          <TableOfContents items={doc.toc} />
        </div>
        <RightRailPanels source={source} />
      </aside>
    </>
  );
}

function FileMeta({
  date,
  author,
  tags,
  mtime,
  updated,
}: {
  date?: string;
  author?: string;
  tags?: string[];
  mtime: number;
  updated?: string;
}) {
  const hasMeta = date || author || (tags && tags.length > 0);
  if (!hasMeta) {
    // Fall back to file modification time so readers always see *something*.
    // `updated` from frontmatter wins when present.
    const updatedDisplay = updated ?? new Date(mtime).toISOString();
    return (
      <div
        className="text-text-light"
        style={{ fontSize: 13 }}
      >
        Updated {formatDate(updatedDisplay)}
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
        <div className="tag-chip-group">
          {tags.map((tag) => (
            <a
              key={tag}
              href={`/read/tags/${encodeURIComponent(tag)}`}
              className="tag-chip"
            >
              {tag}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
