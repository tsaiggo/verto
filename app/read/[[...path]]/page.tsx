import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllReadableSlugs, getNodeBySlug, getPrevNext } from "@/lib/content-source";
import { getDocumentBySlug } from "@/lib/mdx";
import DocumentTabs from "@/components/layout/DocumentTabs";
import InlineCommentProvider from "@/components/mdx/InlineCommentProvider";
import PrevNext from "@/components/reader/PrevNext";
import DirectoryIndex from "@/components/reader/DirectoryIndex";
import ReadingStateTracker from "@/components/reader/ReadingStateTracker";
import ChatColumn from "@/components/reader/ChatColumn";
import ReaderFrame from "@/components/reader/ReaderFrame";
import AnnotationsLayer from "@/components/reader/AnnotationsLayer";
import ArticleTocCard from "@/components/reader/ArticleTocCard";
import { DocCover, DocMasthead } from "@/components/reader/DocMasthead";
import type { TOCItem } from "@/lib/types";

interface ReadPageProps {
  params: Promise<{ path?: string[] }>;
}

function articleTocFrameProps(items: TOCItem[], title: string) {
  if (items.length === 0) return {};

  return {
    context: <ArticleTocCard items={items} title={title} />,
    contextProps: { "aria-label": "Article table of contents" },
  };
}

export async function generateStaticParams() {
  const slugs = await getAllReadableSlugs();
  // Include the root (`/read`) so it's pre-rendered too
  return [{ path: [] }, ...slugs.map((slug) => ({ path: slug }))];
}

export async function generateMetadata({ params }: ReadPageProps): Promise<Metadata> {
  const { path } = await params;
  const slug = path ?? [];

  const node = await getNodeBySlug(slug);
  if (!node) return { title: "Not Found" };
  const description = node.type === "file" ? node.description : `Index of ${node.title}`;
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
  // A top-level file has no useful category of its own. Repeating its title as
  // an eyebrow made the masthead feel like a file inspector instead of an
  // editorial page, so only nested documents inherit a section label.
  const category = titles.length > 1 ? titles[0] : undefined;

  // Directory without an index → render auto index page
  if (node.type === "dir" && !node.index) {
    const directoryContent = (
      <div className="content-wrap prose">
        <DirectoryIndex node={node} />
      </div>
    );

    // `/read` has its own reader-root layout. Nested directories, however,
    // live in the document workspace and must keep the same tabs + scroll
    // contract as a document route or the fixed desktop grid clips the page.
    if (slug.length > 0) {
      return (
        <ReaderFrame mainLabel="Directory content" tabs={<DocumentTabs />} chat={<ChatColumn />}>
          {directoryContent}
        </ReaderFrame>
      );
    }

    return (
      <ReaderFrame mainLabel="Directory content" chat={<ChatColumn />}>
        {directoryContent}
      </ReaderFrame>
    );
  }

  // File (or directory with an index file). The directory-without-index
  // case was handled above, so when we reach this branch and `node.type`
  // is "dir", `node.index` is guaranteed to be defined.
  const targetSlug = node.type === "file" ? node.slug : node.index!.slug;
  const doc = await getDocumentBySlug(targetSlug);
  if (!doc) notFound();

  const [prev, next] = await getPrevNext(targetSlug);
  const file = doc.node;

  return (
    <ReaderFrame
      mainLabel="Document content"
      tabs={<DocumentTabs />}
      {...articleTocFrameProps(doc.toc, file.title)}
      chat={<ChatColumn doc={{ href: file.href, slug: file.slug, title: file.title }} />}
    >
      <DocMasthead file={file} category={category} readingMinutes={doc.readingMinutes} />
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
          <AnnotationsLayer
            docSlug={file.slug.join("/")}
            share={{
              title: file.title,
              author: file.author ?? "Verto",
              tags: file.tags ?? [],
              href: file.href,
            }}
          />
        </InlineCommentProvider>
      </article>
    </ReaderFrame>
  );
}
