import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getAllReadableSlugs,
  getNodeBySlug,
  getPrevNext,
  readFileNodeSource,
} from "@/lib/content-source";
import { getDocumentBySlug } from "@/lib/mdx";
import TableOfContents from "@/components/layout/TableOfContents";
import InlineCommentProvider from "@/components/mdx/InlineCommentProvider";
import PrevNext from "@/components/reader/PrevNext";
import DirectoryIndex from "@/components/reader/DirectoryIndex";
import ReadingStateTracker from "@/components/reader/ReadingStateTracker";
import ChatColumn from "@/components/reader/ChatColumn";
import AnnotationsLayer from "@/components/reader/AnnotationsLayer";
import { SampleReader } from "@/components/reader/SampleReader";
import { AnnotationSystemReader } from "@/components/reader/AnnotationSystemReader";
import { DocMasthead } from "@/components/reader/DocMasthead";

interface ReadPageProps {
  params: Promise<{ path?: string[] }>;
  searchParams?: Promise<{ mode?: string }>;
}

type ReaderMode = "read" | "edit" | "split";

interface DocumentArticleProps {
  readonly file: NonNullable<Awaited<ReturnType<typeof getDocumentBySlug>>>["node"];
  readonly doc: NonNullable<Awaited<ReturnType<typeof getDocumentBySlug>>>;
  readonly category: string | undefined;
  readonly prev: Awaited<ReturnType<typeof getPrevNext>>[0];
  readonly next: Awaited<ReturnType<typeof getPrevNext>>[1];
}

interface DocumentModeProps extends DocumentArticleProps {
  readonly mode: ReaderMode;
  readonly rawSource: string | null;
}

function parseReaderMode(raw: string | undefined): ReaderMode {
  return raw === "edit" || raw === "split" ? raw : "read";
}

function SourceEditor({ title, source }: { readonly title: string; readonly source: string }) {
  return (
    <section className="reader-source-panel" aria-label="Source editor">
      <div className="reader-source-head">
        <div>
          <p className="reader-source-kicker">Local draft</p>
          <h2>{title}</h2>
        </div>
        <span className="reader-source-status">Not saved to source</span>
      </div>
      <textarea
        className="reader-source-input"
        defaultValue={source}
        spellCheck={false}
        aria-label={`${title} source`}
      />
    </section>
  );
}

function DocumentArticle({ file, doc, category, prev, next }: DocumentArticleProps) {
  return (
    <article className="content-wrap prose" lang={file.lang} data-article>
      <ReadingStateTracker
        href={file.href}
        slug={file.slug}
        title={file.title}
        path={`${file.slug.join("/")}${file.ext}`}
      />
      <InlineCommentProvider>
        <DocMasthead file={file} category={category} readingMinutes={doc.readingMinutes} />
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
  );
}

function DocumentModeView({ mode, rawSource, file, doc, category, prev, next }: DocumentModeProps) {
  if (mode === "edit" && rawSource != null) {
    return (
      <section className="main reader-mode-main" aria-label="Document source editor">
        <div className="reader-edit-wrap">
          <SourceEditor title={file.title} source={rawSource} />
        </div>
      </section>
    );
  }

  if (mode === "split" && rawSource != null) {
    return (
      <section className="main reader-mode-main" aria-label="Split document view">
        <div className="reader-split-wrap">
          <div className="reader-split-preview">
            <DocumentArticle file={file} doc={doc} category={category} prev={prev} next={next} />
          </div>
          <SourceEditor title={file.title} source={rawSource} />
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="main" aria-label="Document content">
        <DocumentArticle file={file} doc={doc} category={category} prev={prev} next={next} />
      </section>
      <aside className="toc-rail">
        <div className="rail-panel toc-panel">
          <TableOfContents items={doc.toc} />
        </div>
      </aside>
      <ChatColumn doc={{ href: file.href, slug: file.slug, title: file.title }} />
    </>
  );
}

export async function generateStaticParams() {
  const slugs = await getAllReadableSlugs();
  // Include the root (`/read`) so it's pre-rendered too
  return [{ path: [] }, { path: ["annotation-system"] }, ...slugs.map((slug) => ({ path: slug }))];
}

export async function generateMetadata({ params }: ReadPageProps): Promise<Metadata> {
  const { path } = await params;
  const slug = path ?? [];
  if (isAnnotationSystemDemo(slug)) {
    return {
      title: "Annotation System",
      description: "Reader mode and annotation system",
    };
  }

  const node = await getNodeBySlug(slug);
  if (!node) return { title: "Not Found" };
  const description = node.type === "file" ? node.description : `Index of ${node.title}`;
  return { title: node.title, description };
}

export default async function ReadPage({ params, searchParams }: ReadPageProps) {
  const { path } = await params;
  const mode = parseReaderMode((await searchParams)?.mode);
  const slug = path ?? [];

  if (isAnnotationSystemDemo(slug)) {
    return <AnnotationSystemReader />;
  }

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

  // Directory without an index → render auto index page
  if (node.type === "dir" && !node.index) {
    const visible = node.children.filter((child) => !child.hidden);
    if (slug.length === 0 && visible.length === 0) {
      return <SampleReader />;
    }

    return (
      <>
        <section className="main" aria-label="Directory content">
          <div className="content-wrap prose">
            <DirectoryIndex node={node} />
          </div>
        </section>
        <ChatColumn />
      </>
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
  const rawSource = mode === "read" ? null : await readFileNodeSource(file);

  return (
    <DocumentModeView
      mode={mode}
      rawSource={rawSource}
      file={file}
      doc={doc}
      category={category}
      prev={prev}
      next={next}
    />
  );
}

function isAnnotationSystemDemo(slug: string[]): boolean {
  return slug.length === 1 && slug[0] === "annotation-system";
}
