import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllHelpSlugs, getHelpNodeBySlug, getHelpPrevNext } from "@/lib/help-source";
import type { ContentFileNode } from "@/lib/help-source";
import { getHelpDocumentBySlug } from "@/lib/mdx";
import TableOfContents from "@/components/layout/TableOfContents";
import InlineCommentProvider from "@/components/mdx/InlineCommentProvider";
import PrevNext from "@/components/reader/PrevNext";
import DirectoryIndex from "@/components/reader/DirectoryIndex";
import ReadingStateTracker from "@/components/reader/ReadingStateTracker";
import CopyPageButton from "@/components/reader/CopyPageButton";
import ReaderWorkspace from "@/components/reader/ReaderWorkspace";
import { DocCover } from "@/components/reader/DocMasthead";
import { formatDate } from "@/lib/format";
import { formatReadingTime } from "@/lib/reading-time";

interface HelpPageProps {
  params: Promise<{ path?: string[] }>;
}

export async function generateStaticParams() {
  const slugs = await getAllHelpSlugs();
  // Include the root (`/help`) so it's pre-rendered too
  return [{ path: [] }, ...slugs.map((slug) => ({ path: slug }))];
}

export async function generateMetadata({ params }: HelpPageProps): Promise<Metadata> {
  const { path } = await params;
  const slug = path ?? [];
  const node = await getHelpNodeBySlug(slug);
  if (!node) return { title: "Not Found" };
  const description = node.type === "file" ? node.description : `Index of ${node.title}`;
  return { title: node.title, description };
}

export default async function HelpPage({ params }: HelpPageProps) {
  const { path } = await params;
  const slug = path ?? [];

  const node = await getHelpNodeBySlug(slug);
  if (!node) notFound();

  // Build breadcrumb titles by resolving each prefix
  const titles: string[] = [];
  for (let i = 0; i < slug.length; i++) {
    const prefix = slug.slice(0, i + 1);
    const n = await getHelpNodeBySlug(prefix);
    titles.push(n?.title ?? prefix[prefix.length - 1]);
  }

  // Top-level section name, shown as a category badge above the title.
  const category = titles.length > 1 ? titles[0] : undefined;

  // Directory without an index → render auto index page
  if (node.type === "dir" && !node.index) {
    return (
      <ReaderWorkspace
        documentLabel="Help directory content"
        currentDocument={{ href: node.href, title: node.title }}
      >
        <div className="content-wrap prose">
          <DirectoryIndex node={node} />
        </div>
      </ReaderWorkspace>
    );
  }

  // File (or directory with an index file). The directory-without-index
  // case was handled above, so when we reach this branch and `node.type`
  // is "dir", `node.index` is guaranteed to be defined.
  const targetSlug = node.type === "file" ? node.slug : node.index!.slug;
  const doc = await getHelpDocumentBySlug(targetSlug);
  if (!doc) notFound();

  const [prev, next] = await getHelpPrevNext(targetSlug);
  const file = doc.node;

  return (
    <ReaderWorkspace
      masthead={
        <HelpDocMasthead file={file} category={category} readingMinutes={doc.readingMinutes} />
      }
      toc={doc.toc.length > 0 ? <TableOfContents items={doc.toc} /> : undefined}
      doc={{ href: file.href, slug: file.slug, title: file.title }}
      documentLabel="Help document content"
    >
      <article className="content-wrap prose" lang={file.lang} data-article>
        <ReadingStateTracker
          href={file.href}
          slug={file.slug}
          title={file.title}
          path={`${file.slug.join("/")}${file.ext}`}
        />
        <InlineCommentProvider>
          <DocCover file={file} />
          {doc.content}
          <PrevNext prev={prev} next={next} />
        </InlineCommentProvider>
      </article>
    </ReaderWorkspace>
  );
}

function HelpDocMasthead({
  file,
  category,
  readingMinutes,
}: {
  file: ContentFileNode;
  category?: string;
  readingMinutes: number;
}) {
  // One mono eyebrow line: [category pill] · updated date · reading time.
  const dateLabel = file.date
    ? formatDate(file.date)
    : `Updated ${formatDate(file.updated ?? new Date(file.mtime).toISOString())}`;
  const readingLabel = formatReadingTime(readingMinutes);
  const authorInitial = file.author?.trim().charAt(0).toUpperCase();
  return (
    <header className="doc-header" data-page-identity>
      <div className="doc-identity">
        <div className="doc-identity-copy">
          <div className="doc-eyebrow">
            {category && <span className="doc-eyebrow-pill">{category}</span>}
            <span>{dateLabel}</span>
            <span className="doc-eyebrow-dot" aria-hidden>
              ·
            </span>
            <span>{readingLabel}</span>
          </div>
          <div className="doc-title-row">
            <h1 className="doc-title">{file.title}</h1>
            {file.draft && (
              <span className="draft-badge" aria-label="Draft document">
                Draft
              </span>
            )}
          </div>
          {file.dek && <p className="doc-dek">{file.dek}</p>}
          {file.author && (
            <div className="doc-authorline">
              <span className="doc-avatar" aria-hidden>
                {authorInitial}
              </span>
              <span>By {file.author}</span>
            </div>
          )}
          {file.tags && file.tags.length > 0 && (
            // Help has no tag index; keep labels within Help rather than linking to Library.
            <div className="doc-tags tag-chip-group">
              {file.tags.map((tag) => (
                <span key={tag} className="tag-chip">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <CopyPageButton />
    </header>
  );
}
