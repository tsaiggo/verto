// /read/annotation-system demo reader (static): sidebar + article + context rail.
import {
  BookOpen,
  ChevronDown,
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
  StickyNote,
} from "lucide-react";

function AnnotationSidebar() {
  return (
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
  );
}

function AnnotationArticle() {
  return (
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
          The Annotation System enables readers to highlight, comment, and connect ideas directly in
          the flow of reading. Annotations are{" "}
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
              Use short, descriptive notes. Future you (or your team) should understand the context
              without opening another tab.
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
  );
}

function AnnotationContextRail() {
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

export function AnnotationSystemReader() {
  return (
    <>
      <AnnotationSidebar />
      <AnnotationArticle />
      <AnnotationContextRail />
    </>
  );
}
