import Link from "next/link";
import type { Metadata } from "next";
import { getAllBlogPosts } from "@/lib/mdx";

export const metadata: Metadata = {
  title: "Blog",
  description: "Thoughts on writing, documentation, and building with MDX.",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPage() {
  const posts = await getAllBlogPosts();

  return (
    <div>
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "60px 24px",
        }}
      >
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            marginBottom: 8,
            color: "var(--text)",
          }}
        >
          From the Blog
        </h1>
        <p
          className="text-text-muted"
          style={{ fontSize: 16, marginBottom: 48 }}
        >
          Thoughts on writing, documentation, and building with MDX.
        </p>

        <div
          style={{
            display: "grid",
            gap: 24,
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          }}
        >
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <article
                style={{
                  padding: 24,
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  transition: "border-color 150ms ease, box-shadow 150ms ease",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
                className="hover:border-accent-blue"
              >
                <time
                  className="text-text-muted"
                  style={{ fontSize: 13, fontWeight: 500 }}
                >
                  {formatDate(post.date)}
                </time>

                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    lineHeight: 1.3,
                    color: "var(--text)",
                    margin: 0,
                  }}
                >
                  {post.title}
                </h2>

                {post.description && (
                  <p
                    className="text-text-muted"
                    style={{
                      fontSize: 14,
                      lineHeight: 1.6,
                      margin: 0,
                      flex: 1,
                    }}
                  >
                    {post.description}
                  </p>
                )}

                {post.tags?.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      marginTop: "auto",
                    }}
                  >
                    {post.tags.map((tag) => (
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
              </article>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
