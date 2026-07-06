// Empty-library sample reader shown at /read when no content exists yet.
import {
  BookOpen,
  Box,
  BrainCircuit,
  CircleArrowRight,
  FileText,
  Plus,
  Sparkles,
  SquareArrowOutUpRight,
} from "lucide-react";

export function SampleReader() {
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
            It is designed for people who work with long-form content, technical documents, research
            papers and personal knowledge.
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
