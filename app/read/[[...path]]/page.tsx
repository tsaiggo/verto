import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  BookOpen,
  Box,
  BrainCircuit,
  ChevronDown,
  CircleArrowRight,
  Copy,
  FileText,
  Highlighter,
  Info,
  Lightbulb,
  Link2,
  MessageCircle,
  Plus,
  Scissors,
  SendHorizontal,
  Sparkles,
  SquareArrowOutUpRight,
  StickyNote,
} from "lucide-react";
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

export default async function ReadPage({ params }: ReadPageProps) {
  const { path } = await params;
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

  function SampleReader() {
    const toc = [
      "Introduction",
      "What is Verto?",
      "The Verto Workflow",
      "Core Principles",
      "Why MDX?",
      "Who is it for?",
    ];
    const linked = ["Why Verto?", "Key Features", "Keyboard Shortcuts"];
    const backlinks = ["Verto Roadmap", "Agent Design Notes", "Knowledge Graph Ideas"];
    const workflow = [
      { label: "Capture", detail: "From information", icon: Box },
      { label: "Read", detail: "Deeply", icon: BookOpen },
      { label: "Understand", detail: "(Agent)", icon: BrainCircuit },
      { label: "Create", detail: "Your knowledge", icon: SquareArrowOutUpRight },
      { label: "Connect", detail: "The dots", icon: CircleArrowRight },
    ];

    return (
      <>
        <section className="main reader-overview-main" aria-label="Document content">
          <article
            className="content-wrap prose reader-sample-article reader-overview-article"
            lang="en"
            data-article
          >
            <header className="doc-header">
              <h1 className="doc-title">Introduction</h1>
            </header>

            <div className="reader-overview-hero">
              Verto is a local-first knowledge workspace for reading, writing and thinking with the
              help of AI agents.
            </div>

            <p>
              It is designed for people who work with long-form content, technical documents,
              research papers and personal knowledge.
            </p>

            <h2>What is Verto?</h2>
            <p>Verto is a modern MDX reader and editor with AI-native capabilities.</p>
            <ul>
              <li>Read everything with excellent rendering</li>
              <li>Write with MDX components</li>
              <li>Organize your knowledge in a local library</li>
              <li>Ask questions and get answers with sources</li>
              <li>Let agents help you create, refactor and connect ideas</li>
            </ul>

            <div className="reader-overview-workflow">
              <h3>The Verto Workflow</h3>
              <div className="reader-overview-flow">
                {workflow.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div className="reader-overview-flow-item" key={step.label}>
                      <span className="reader-overview-flow-icon">
                        <Icon aria-hidden />
                      </span>
                      <strong>{step.label}</strong>
                      <span>{step.detail}</span>
                      {index < workflow.length - 1 && (
                        <i className="reader-overview-flow-arrow" aria-hidden>
                          →
                        </i>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="reader-overview-meta" aria-label="Document metrics">
              <span>12,348 words</span>
              <span>8 min read</span>
            </div>
          </article>
        </section>

        <aside
          className="toc-rail reader-sample-context reader-overview-context"
          aria-label="Document context"
        >
          <div className="rail-panel toc-panel reader-overview-panel">
            <section className="reader-overview-rail-section">
              <h3>OUTLINE</h3>
              <ol className="reader-outline-tree">
                {toc.map((label, index) => (
                  <li key={label} className={index === 0 ? "is-active" : undefined}>
                    {label}
                  </li>
                ))}
              </ol>
            </section>

            <section className="reader-overview-rail-section">
              <div className="reader-overview-rail-head">
                <h3>LINKED CONTENT</h3>
                <Plus aria-hidden />
              </div>
              {linked.map((label) => (
                <span className="reader-overview-link-row" key={label}>
                  <FileText aria-hidden />
                  {label}
                </span>
              ))}
            </section>

            <section className="reader-overview-rail-section">
              <div className="reader-overview-rail-head">
                <h3>BACKLINKS</h3>
                <Sparkles aria-hidden />
              </div>
              {backlinks.map((label) => (
                <span className="reader-overview-link-row" key={label}>
                  <FileText aria-hidden />
                  {label}
                </span>
              ))}
            </section>
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

function isAnnotationSystemDemo(slug: string[]): boolean {
  return slug.length === 1 && slug[0] === "annotation-system";
}

function AnnotationSystemReader() {
  const toc = [
    { label: "Annotation System", level: 0 },
    { label: "Core capabilities", level: 1 },
    { label: "MDX Component Example", level: 1 },
    { label: "Code Example", level: 1 },
    { label: "Data Model", level: 1 },
    { label: "Annotation", level: 2 },
    { label: "Anchor", level: 2 },
    { label: "Note", level: 2 },
    { label: "Behaviors", level: 1 },
    { label: "Selection & Anchoring", level: 2 },
    { label: "Sync & Collaboration", level: 2 },
    { label: "Permissions", level: 2 },
    { label: "API Reference", level: 1 },
    { label: "Appendix", level: 1 },
  ];

  const notes = [
    {
      author: "You",
      time: "2d ago",
      quote: "anchored to exact text ranges",
      body: "Important for reliability across edits and version changes.",
      tone: "yellow",
      tag: "Add tag...",
    },
    {
      author: "Maya",
      time: "5d ago",
      quote: "Annotations are first-class objects in Verto.",
      body: "Consider linking to data model section for more depth.",
      tone: "green",
      tag: "data model",
    },
    {
      author: "You",
      time: "1w ago",
      quote: "Use short, descriptive notes.",
      body: "Great guideline - add to best practices.",
      tone: "blue",
      tag: "guidelines",
    },
  ];

  return (
    <>
      <aside className="sidebar reader-sample-sidebar" aria-label="Sources and document tree">
        <div className="reader-sample-sidehead">
          <span>Sources</span>
          <span className="reader-sample-tools">
            <Plus aria-hidden />
          </span>
        </div>
        <div className="reader-sample-add-source">
          <Plus aria-hidden />
          Add source
        </div>
        <div className="reader-sample-tree">
          {[
            ["Verto Docs", "312"],
            ["Product Wiki", "128"],
            ["Engineering Notes", "89"],
            ["Design System", "54"],
            ["Research Library", "173"],
            ["Meeting Notes", "42"],
          ].map(([label, count], index) => (
            <div key={label} className={`reader-sample-source${index === 0 ? " is-active" : ""}`}>
              <BookOpen aria-hidden />
              <span>{label}</span>
              <span className="reader-sample-sidecount">{count}</span>
            </div>
          ))}
          <div className="reader-sample-source reader-sample-more">
            <ChevronDown aria-hidden />
            <span>More sources</span>
          </div>
        </div>

        <div className="reader-sample-doc-tree">
          <div className="reader-sample-sidehead">
            <span>Document Tree</span>
          </div>
          <div className="reader-sample-tree">
            <div className="reader-sample-folder is-open">
              <BookOpen aria-hidden />
              Reader System
            </div>
            {["Overview", "Goals & Principles", "Information Architecture"].map((label) => (
              <div key={label} className="reader-sample-file">
                <FileText aria-hidden />
                <span>{label}</span>
              </div>
            ))}
            <div className="reader-sample-folder is-open is-active">
              <BookOpen aria-hidden />
              Annotation System
            </div>
            {["Data Model", "Anchoring & Ranges", "Rendering", "Sync & Offline"].map((label) => (
              <div key={label} className="reader-sample-file">
                <FileText aria-hidden />
                <span>{label}</span>
              </div>
            ))}
            <div className="reader-sample-folder is-open">
              <BookOpen aria-hidden />
              Reader Mode
            </div>
            {["UI Layout", "Interaction Model", "Settings"].map((label) => (
              <div key={label} className="reader-sample-file">
                <FileText aria-hidden />
                <span>{label}</span>
              </div>
            ))}
            <div className="reader-sample-folder">
              <BookOpen aria-hidden />
              Appendix
            </div>
            <div className="reader-sample-file">
              <FileText aria-hidden />
              <span>Changelog</span>
            </div>
          </div>
        </div>
      </aside>

      <section className="main" aria-label="Document content">
        <div className="reader-sample-settings-popover" aria-label="Reading settings">
          <div className="reader-settings-title">Reading settings</div>
          <div className="reader-settings-row">
            <span>Font size</span>
            <span className="reader-settings-value">16px</span>
          </div>
          <div className="reader-settings-segment">
            <span>A-</span>
            <strong>16px</strong>
            <span>A+</span>
          </div>
          <div className="reader-settings-row">
            <span>Line width</span>
          </div>
          <div className="reader-settings-segment">
            <span>☰</span>
            <strong>☷</strong>
            <span>☰</span>
          </div>
          <div className="reader-settings-row">
            <span>Theme</span>
          </div>
          <div className="reader-settings-segment">
            <strong>Light</strong>
            <span>Sepia</span>
            <span>Dark</span>
          </div>
          <div className="reader-settings-row">
            <span>Focus mode</span>
            <span className="reader-settings-toggle" aria-hidden />
          </div>
          <div className="reader-settings-hint">
            <span>Hide nonessential chrome</span>
            <span className="reader-settings-hint-kbd">⌘/</span>
          </div>
        </div>
        <article className="content-wrap prose reader-sample-article" lang="en" data-article>
          <header className="doc-header">
            <h1 className="doc-title">Annotation System</h1>
          </header>

          <p>
            The Annotation System enables readers to highlight, comment, and connect ideas directly
            in the flow of reading. Annotations are{" "}
            <mark className="reader-sample-highlight">anchored to exact text ranges</mark>, persist
            across edits, and surface in the right context.
          </p>

          <div className="reader-sample-toolbar" aria-label="Selection actions">
            {[
              { label: "Highlight", icon: Highlighter },
              { label: "Note", icon: StickyNote },
              { label: "Explain", icon: Sparkles },
              { label: "Ask", icon: MessageCircle },
              { label: "Extract", icon: Scissors },
              { label: "Copy link", icon: Link2 },
            ].map(({ label, icon: Icon }) => (
              <button key={label} type="button">
                <Icon aria-hidden />
                {label}
              </button>
            ))}
          </div>

          <h2>Core capabilities</h2>
          <ul>
            <li>Rich highlights with inline actions</li>
            <li>Notes anchored to quoted passages</li>
            <li>Connections to related documents and concepts</li>
            <li>AI assistance grounded in your library</li>
          </ul>

          <div className="reader-sample-callout is-neutral">
            <Info aria-hidden />
            <div>
              <strong>Annotations are first-class objects in Verto.</strong> They are syncable,
              version-aware, and designed to scale across long documents and teams.
            </div>
          </div>

          <h2>MDX Component Example</h2>
          <p>MDX lets us embed rich, interactive components directly in content.</p>

          <div className="reader-sample-callout is-green">
            <Lightbulb aria-hidden />
            <div>
              <strong>Tip</strong>
              <p>
                Use short, descriptive notes. Future you (or your team) should understand the
                context without opening another tab.
              </p>
            </div>
          </div>

          <h2>Code Example</h2>
          <p>Annotations can also live near code with precise anchoring.</p>
          <div className="reader-sample-codeblock">
            <div className="reader-sample-code-head">
              <span>tsx</span>
              <button type="button" aria-label="Copy code">
                <Copy aria-hidden />
              </button>
            </div>
            <pre className="reader-sample-code">
              <code>
                {[
                  `import { createAnnotation } from "@verto/annotations";`,
                  ``,
                  `const note = createAnnotation({`,
                  `  range: selection.range,`,
                  `  text: selection.text,`,
                  `  type: "note",`,
                  `  content: "Clarify the data model relationship here.",`,
                  `});`,
                ].map((line, index) => (
                  <span key={`${index}-${line}`} className="reader-code-line">
                    <span className="reader-code-ln">{index + 1}</span>
                    <span className="reader-code-tx">{line || "\u00A0"}</span>
                  </span>
                ))}
              </code>
            </pre>
          </div>
        </article>
      </section>

      <aside className="toc-rail reader-sample-context" aria-label="Document context">
        <div className="rail-panel toc-panel">
          <div className="reader-sample-context-tabs">
            <span className="is-active">Outline</span>
            <span>
              Notes <strong>6</strong>
            </span>
            <span>
              Backlinks <strong>12</strong>
            </span>
            <span>Assistant</span>
          </div>
          <div className="reader-context-grid">
            <ol className="reader-outline-tree">
              {toc.map((item) => (
                <li
                  key={item.label}
                  data-level={item.level}
                  className={item.level === 0 ? "is-active" : undefined}
                >
                  {item.label}
                </li>
              ))}
            </ol>
            <div className="reader-note-list">
              {notes.map((note) => (
                <article key={note.quote} className="reader-note-card">
                  <div className="reader-note-meta">
                    <span className={`reader-note-dot is-${note.tone}`} aria-hidden />
                    <strong>{note.author}</strong>
                    <span>{note.time}</span>
                  </div>
                  <blockquote>&quot;{note.quote}&quot;</blockquote>
                  <p>{note.body}</p>
                  <span className="reader-note-tag">{note.tag}</span>
                </article>
              ))}
              <button type="button" className="reader-new-note">
                + New note
              </button>
            </div>
          </div>
          <div className="reader-sample-related reader-backlinks">
            <h3>Linked from other documents</h3>
            <span>Reader Mode Overview.mdx</span>
            <span>Selection & Anchoring.mdx</span>
            <span>Data Model.mdx</span>
            <strong>View all backlinks (12)</strong>
          </div>
          <div className="reader-sample-related reader-assistant-summary">
            <h3>Assistant Summary</h3>
            <p>
              This section explains how annotations are anchored to exact text ranges to remain
              stable across edits and versions.
            </p>
            <span>Sources: Data Model.mdx, Selection & Anchoring.mdx</span>
          </div>
        </div>
        <div className="reader-sample-context-composer">
          <span>Ask anything about this document...</span>
          <button type="button" aria-label="Send message">
            <SendHorizontal aria-hidden />
          </button>
        </div>
      </aside>
      <div className="reader-sample-statusbar" aria-hidden>
        <span className="reader-status-left">
          <span>Annotation System.mdx</span>
          <span className="reader-status-saved">Saved</span>
        </span>
        <span className="reader-status-center">3,842 words · 18 min read</span>
        <span className="reader-status-right">
          <span>3 collaborators</span>
          <span className="reader-status-avatar">A</span>
          <span className="reader-status-avatar">M</span>
          <span className="reader-status-avatar">J</span>
          <span className="reader-status-more">+1</span>
        </span>
      </div>
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
