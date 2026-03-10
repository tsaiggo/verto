import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBlogBySlug, getAllBlogSlugs } from "@/lib/mdx";
import TableOfContents from "@/components/layout/TableOfContents";
import InlineCommentProvider from "@/components/mdx/InlineCommentProvider";
import SelectionShareProvider from '@/components/ui/SelectionShareProvider';
import SelectionShareButton from '@/components/ui/SelectionShareButton';
import { formatDate } from "@/lib/format";

interface BlogPostProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getAllBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: BlogPostProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { frontmatter } = await getBlogBySlug(slug);
    return {
      title: frontmatter.title,
      description: frontmatter.description,
    };
  } catch (error) {
    console.error('Failed to generate blog metadata:', slug, error);
    return { title: "Not Found" };
  }
}

export default async function BlogPost({ params }: BlogPostProps) {
  const { slug } = await params;

  let result;
  try {
    result = await getBlogBySlug(slug);
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error('Blog post not found:', slug, error);
      notFound();
    }
    console.error('Failed to load blog post:', slug, error);
    throw error;
  }

  const { content, frontmatter, toc } = result;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 40,
          maxWidth: 1100,
          margin: "0 auto",
          padding: "40px 20px",
        }}
      >
        <SelectionShareProvider>
        <article
          className="prose"
          data-article
          style={{
            maxWidth: 720,
            width: "100%",
            minWidth: 0,
          }}
        >
          <header style={{ marginBottom: 32 }}>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 700,
                lineHeight: 1.25,
                marginBottom: 12,
                color: "var(--text)",
              }}
            >
              {frontmatter.title}
            </h1>

            <div
              className="text-text-muted"
              style={{
                fontSize: 14,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <time>{formatDate(frontmatter.date)}</time>
              <span>{frontmatter.author}</span>
            </div>

            {frontmatter.tags?.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 8,
                  flexWrap: "wrap",
                }}
              >
                {frontmatter.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-text-muted"
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
          </header>

          <InlineCommentProvider>{content}</InlineCommentProvider>
        </article>
        <SelectionShareButton
          title={frontmatter.title}
          author={frontmatter.author}
          tags={frontmatter.tags}
          slug={slug}
        />
        </SelectionShareProvider>

        <TableOfContents items={toc} />
      </div>
    </div>
  );
}
