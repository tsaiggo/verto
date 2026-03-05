import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDocBySlug, getAllDocSlugs } from "@/lib/mdx";
import TableOfContents from "@/components/layout/TableOfContents";
import InlineCommentProvider from "@/components/mdx/InlineCommentProvider";

interface DocsPageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { slug } = await params;
  const resolvedSlug = slug ?? ["getting-started", "introduction"];

  try {
    const { content, frontmatter, toc } = await getDocBySlug(resolvedSlug);

    return (
      <>
        <main className="main">
          <div className="content-wrap prose">
            <InlineCommentProvider>
              <h1>{frontmatter.title}</h1>
              {content}
            </InlineCommentProvider>
          </div>
        </main>
        <aside className="toc-sidebar">
          <TableOfContents items={toc} />
        </aside>
      </>
    );
  } catch {
    notFound();
  }
}

export async function generateStaticParams() {
  const slugs = await getAllDocSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: DocsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSlug = slug ?? ["getting-started", "introduction"];

  try {
    const { frontmatter } = await getDocBySlug(resolvedSlug);
    return {
      title: frontmatter.title,
      description: frontmatter.description,
    };
  } catch {
    return { title: "Not Found" };
  }
}
