import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllHelpSlugs, getHelpNodeBySlug, getHelpPrevNext } from "@/lib/help-source";
import { getHelpDocumentBySlug } from "@/lib/mdx";
import TableOfContents from "@/components/layout/TableOfContents";
import InlineCommentProvider from "@/components/mdx/InlineCommentProvider";
import PrevNext from "@/components/reader/PrevNext";
import DirectoryIndex from "@/components/reader/DirectoryIndex";
import ReadingStateTracker from "@/components/reader/ReadingStateTracker";
import ChatColumn from "@/components/reader/ChatColumn";
import ReaderFrame from "@/components/reader/ReaderFrame";
import { DocCover, DocMasthead } from "@/components/reader/DocMasthead";

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
  const category = titles[0];

  // Directory without an index → render auto index page
  if (node.type === "dir" && !node.index) {
    return (
      <ReaderFrame mainLabel="Directory content" chat={<ChatColumn />}>
        <div className="content-wrap prose">
          <DirectoryIndex node={node} />
        </div>
      </ReaderFrame>
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
    <ReaderFrame
      mainLabel="Document content"
      mainProps={{ lang: file.lang }}
      context={
        <div className="rail-panel toc-panel">
          <TableOfContents items={doc.toc} />
        </div>
      }
      chat={<ChatColumn doc={{ href: file.href, slug: file.slug, title: file.title }} />}
    >
      <article className="content-wrap prose" lang={file.lang}>
        <ReadingStateTracker
          href={file.href}
          slug={file.slug}
          title={file.title}
          path={`${file.slug.join("/")}${file.ext}`}
        />
        <InlineCommentProvider>
          <DocMasthead
            file={file}
            category={category}
            readingMinutes={doc.readingMinutes}
            mode="help"
          />
          <DocCover file={file} />
          {doc.content}
          <PrevNext prev={prev} next={next} />
        </InlineCommentProvider>
      </article>
    </ReaderFrame>
  );
}
