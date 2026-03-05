import Link from 'next/link';
import { getAllBlogPosts } from '@/lib/mdx';

export default async function HomePage() {
  const posts = await getAllBlogPosts();
  const recentPosts = posts.slice(0, 3);

  return (
    <div>
      {/* Hero Section */}
      <section
        className="flex flex-col items-center text-center"
        style={{ padding: '80px 20px 64px' }}
      >
        <h1
          className="font-bold tracking-tight text-text"
          style={{ fontSize: 'clamp(48px, 8vw, 72px)', letterSpacing: '-1.5px', lineHeight: 1.1 }}
        >
          Verto
        </h1>
        <p
          className="text-text-muted"
          style={{ fontSize: 'clamp(18px, 3vw, 22px)', marginTop: 16, letterSpacing: '-0.2px' }}
        >
          Write. Transform. Publish.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3" style={{ marginTop: 40 }}>
          <Link
            href="/docs"
            className="inline-flex items-center justify-center font-medium text-white no-underline transition-opacity duration-150 hover:opacity-90"
            style={{
              background: 'var(--accent-blue)',
              padding: '10px 28px',
              borderRadius: 'var(--radius)',
              fontSize: 15,
            }}
          >
            Get Started
          </Link>
          <Link
            href="/blog"
            className="inline-flex items-center justify-center font-medium text-text no-underline transition-colors duration-150 hover:bg-bg-muted"
            style={{
              border: '1px solid var(--border)',
              padding: '10px 28px',
              borderRadius: 'var(--radius)',
              fontSize: 15,
            }}
          >
            Read Blog
          </Link>
        </div>
      </section>

      {/* Recent Blog Posts */}
      {recentPosts.length > 0 && (
        <section
          className="mx-auto w-full"
          style={{ maxWidth: 720, padding: '0 20px 80px' }}
        >
          <h2
            className="font-semibold text-text"
            style={{ fontSize: 22, letterSpacing: '-0.3px', marginBottom: 24 }}
          >
            From the Blog
          </h2>
          <div className="flex flex-col" style={{ gap: 16 }}>
            {recentPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block rounded-lg border border-border bg-bg no-underline transition-colors duration-150 hover:bg-bg-muted"
                style={{ padding: '20px 24px', borderRadius: 'var(--radius-lg)' }}
              >
                <h3
                  className="font-semibold text-text"
                  style={{ fontSize: 17, letterSpacing: '-0.2px', marginBottom: 4 }}
                >
                  {post.title}
                </h3>
                <p
                  className="text-text-muted"
                  style={{ fontSize: 14, marginBottom: 8, lineHeight: 1.6 }}
                >
                  {post.description}
                </p>
                <time
                  className="text-text-light"
                  style={{ fontSize: 13 }}
                  dateTime={post.date}
                >
                  {new Date(post.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
