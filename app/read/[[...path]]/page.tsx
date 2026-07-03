import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookOpen, CheckCircle2, FileText, GitBranch, Lightbulb, Sparkles } from "lucide-react";
import { getAllReadableSlugs, getNodeBySlug, getPrevNext } from "@/lib/content-source";
import type { ContentFileNode } from "@/lib/content-source";
import { getDocumentBySlug } from "@/lib/mdx";
import TableOfContents from "@/components/layout/TableOfContents";
import InlineCommentProvider from "@/components/mdx/InlineCommentProvider";
import PrevNext from "@/components/reader/PrevNext";
import DirectoryIndex from "@/components/reader/DirectoryIndex";
import ReadingStateTracker from "@/components/reader/ReadingStateTracker";
import ChatColumn from "@/components/reader/ChatColumn";
import AnnotationsLayer from "@/components/reader/AnnotationsLayer";
import CopyPageButton from "@/components/reader/CopyPageButton";
import { formatDate } from "@/lib/format";
import { formatReadingTime } from "@/lib/reading-time";

interface ReadPageProps {
  params: Promise<{ path?: string[] }>;
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

  function SampleReader() {
    const toc = [
      "Agent-native Workflows",
      "What is Agent-native?",
      "A typical agent-native workflow",
      "Core Principles",
    ];

    return (
      <>
        <aside className="sidebar reader-sample-sidebar" aria-label="Sources">
          <div className="reader-sample-sidehead">
            <span>Sources</span>
            <span className="reader-sample-sidecount">10</span>
          </div>
          <div className="reader-sample-tree">
            <div className="reader-sample-folder is-open">
              <BookOpen aria-hidden />
              AI &amp; Agents
            </div>
            {[
              "Agent-native Workflows.md",
              "Section 1 · Introduction",
              "Section 2 · Core Principles",
              "Section 3 · Design Patterns",
              "Section 4 · Implementation",
            ].map((label, index) => (
              <div key={label} className={`reader-sample-file${index === 0 ? " is-active" : ""}`}>
                <FileText aria-hidden />
                <span>{label}</span>
              </div>
            ))}
            <div className="reader-sample-folder">
              <BookOpen aria-hidden />
              Key Features.md
            </div>
            <div className="reader-sample-folder">
              <BookOpen aria-hidden />
              AI in Product Design.md
            </div>
          </div>
        </aside>

        <section className="main" aria-label="Document content">
          <article className="content-wrap prose reader-sample-article" lang="en" data-article>
            <header className="doc-header">
              <div className="doc-eyebrow">
                <span className="doc-eyebrow-pill">AI &amp; Agents</span>
                <span>Updated May 12, 2025</span>
                <span className="doc-eyebrow-dot" aria-hidden>
                  ·
                </span>
                <span>8 min read</span>
              </div>
              <h1 className="doc-title">Agent-native Workflows</h1>
              <p className="doc-dek">
                Designing knowledge work so AI agents can plan, execute, and verify outcomes with
                shared context.
              </p>
            </header>

            <div className="reader-sample-callout">
              <Sparkles aria-hidden />
              <div>
                <strong>Goal</strong>
                <p>
                  Build a system where agents understand context, suggest next steps, and keep
                  humans in control.
                </p>
              </div>
            </div>

            <h2>What is Agent-native?</h2>
            <p>
              Agent-native workflows are designed around collaboration between people, documents,
              and autonomous helpers. Instead of treating AI as a command palette, Verto grounds
              every action in the user&apos;s library.
            </p>
            <ul>
              <li>Read your sources, citations, and recent edits before acting.</li>
              <li>Plan changes in small, reviewable steps.</li>
              <li>Keep approval and provenance visible throughout the workflow.</li>
            </ul>

            <h2>A typical agent-native workflow</h2>
            <div className="reader-sample-cards">
              <div className="reader-sample-card">
                <BookOpen aria-hidden />
                <strong>Input</strong>
                <span>Documents and notes from the local library.</span>
              </div>
              <div className="reader-sample-card">
                <GitBranch aria-hidden />
                <strong>Plan</strong>
                <span>Small steps with source references.</span>
              </div>
              <div className="reader-sample-card">
                <CheckCircle2 aria-hidden />
                <strong>Verify</strong>
                <span>Reviewable changes and grounded output.</span>
              </div>
            </div>

            <h2>Core Principles</h2>
            <p>
              These principles guide every agent feature in Verto: context is everything, tools are
              not steps, and the human remains in the loop.
            </p>
            <div className="reader-sample-note">
              <Lightbulb aria-hidden />
              <span>The agent is most useful when it can cite, compare, and explain.</span>
            </div>
          </article>
        </section>

        <aside className="toc-rail reader-sample-context" aria-label="Document context">
          <div className="rail-panel toc-panel">
            <div className="reader-sample-context-tabs">
              <span className="is-active">Outline</span>
              <span>Links</span>
              <span>Backlinks</span>
              <span>Assistant</span>
            </div>
            <ol>
              {toc.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
            <div className="reader-sample-related">
              <h3>Related</h3>
              <span>Key Features</span>
              <span>Implementation Checklist</span>
              <span>Evaluation Framework</span>
            </div>
          </div>
        </aside>
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

  return (
    <>
      <section className="main" aria-label="Document content">
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

function DocMasthead({
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
    <>
      <CopyPageButton />
      <header className="doc-header">
        <div className="doc-eyebrow">
          {category && <span className="doc-eyebrow-pill">{category}</span>}
          <span>{dateLabel}</span>
          <span className="doc-eyebrow-dot" aria-hidden>
            ·
          </span>
          <span>{readingLabel}</span>
        </div>
        {file.draft && (
          <span className="draft-badge" aria-label="Draft document">
            Draft
          </span>
        )}
        <h1 className="doc-title">{file.title}</h1>
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
          <div className="doc-tags tag-chip-group">
            {file.tags.map((tag) => (
              <a key={tag} href={`/read/tags/${encodeURIComponent(tag)}`} className="tag-chip">
                {tag}
              </a>
            ))}
          </div>
        )}
      </header>
      {file.cover ? (
        <div className="article-cover">
          {/* Static cover image. Use a plain <img> so the path can be a remote
              URL or a relative content path without configuring Next's image
              optimizer per source. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={file.cover} alt="" loading="lazy" />
        </div>
      ) : (
        // Decorative editorial band when the doc has no cover image.
        <div className="doc-hero" aria-hidden />
      )}
    </>
  );
}
