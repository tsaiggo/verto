import {
  AlignLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CornerUpLeft,
  FileText,
  Folder,
  Library,
  ListChecks,
  MoreHorizontal,
  PenLine,
  RefreshCw,
  Rocket,
  Search,
  SendHorizontal,
  Settings2,
  Share2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Agent Workspace" };

const workspaceDocs = [
  ["Introduction", true],
  ["Agent Research", false],
  ["Market Analysis", false],
  ["User Interviews", false],
  ["Roadmap", false],
] as const;

const collections = ["Product", "Engineering", "Research", "Design", "Archive"];

const docBullets = [
  "Read and write with context, including 10k+ MDX and document types.",
  "Use verified, cited information for all insights.",
  "Organize your knowledge in a live library.",
  "Ask questions and get answers with sources.",
  "Let agents help you research, draft, and commit changes.",
];

const scopeChips = [
  ["Current selection", false],
  ["Current document", true],
  ["Folder", false],
  ["Entire library", false],
] as const;

const suggestedPrompts = [
  ["Summarize this document", AlignLeft],
  ["Extract key decisions", ListChecks],
  ["Find related research", Search],
  ["Draft next steps", PenLine],
] as const;

const citedSources = [
  ["Introduction", "Section: What is Verto?", "this document"],
  ["Product Principles.md", "Section: Core Principles", ""],
  ["Vision & Strategy.pdf", "Page 4", ""],
] as const;

const toolSteps = [
  "get_current_doc",
  "search_doc",
  "list_notes",
  "get_saved_summary",
  "create_highlight_note",
  "save_summary",
];

const proposedFiles = [
  ["Product Principles.md", "Edit · 8 additions"],
  ["Summary — Introduction.md", "Add · New note"],
  ["Key Takeaways.md", "Add · New note"],
] as const;

const diffLines = [
  [11, "@@ -12,6 +12,10 @@ Core Principles", "hunk"],
  [12, "- User trust through verifiable sources.", "ctx"],
  [13, "- Clarity over cleverness.", "ctx"],
  [14, "- Ships with opinionated defaults.", "ctx"],
  [15, "+ Agent-native by default.", "add"],
  [16, "+ Explicit approval for writes.", "add"],
  [17, "+ Every answer is cited.", "add"],
  [18, "+ Reversible changes.", "add"],
  [19, "- Designed for deep work.", "ctx"],
] as const;

export default function AgentPage() {
  return (
    <section className="agw" aria-label="Agent Workspace and Write Approval">
      {/* Column 1 — workspace navigation */}
      <aside className="agw-nav" aria-label="Workspace navigation">
        <Link href="/" className="agw-brand">
          <span className="agw-brand-mark">V</span>
          Verto
        </Link>

        <nav className="agw-nav-top">
          <Link href="/library" className="agw-nav-link">
            <Library aria-hidden />
            Library
          </Link>
          <span className="agw-nav-link">
            <Rocket aria-hidden />
            Getting Started
          </span>
        </nav>

        <div className="agw-nav-section">
          <span className="agw-nav-label">Workspace</span>
          {workspaceDocs.map(([name, active]) => (
            <span key={name} className={`agw-nav-link${active ? " is-active" : ""}`}>
              <FileText aria-hidden />
              {name}
            </span>
          ))}
        </div>

        <div className="agw-nav-section">
          <span className="agw-nav-label">Collections</span>
          {collections.map((name) => (
            <span key={name} className="agw-nav-link">
              <Folder aria-hidden />
              {name}
            </span>
          ))}
        </div>

        <div className="agw-nav-spacer" />

        <div className="agw-account">
          <span className="agw-avatar">A</span>
          <div>
            <strong>Ava Morgan</strong>
            <span>ava@verto.dev</span>
          </div>
        </div>
      </aside>

      {/* Column 2 — document reader */}
      <main className="agw-doc" aria-label="Document">
        <header className="agw-doc-bar">
          <div className="agw-doc-crumb">
            <button type="button" className="agw-icon-btn" aria-label="Undo">
              <CornerUpLeft aria-hidden />
            </button>
            <FileText aria-hidden className="agw-doc-crumb-icon" />
            <span>Introduction</span>
          </div>
          <div className="agw-mode-switch" role="group" aria-label="Reading mode">
            <button type="button" className="is-active">
              Read
            </button>
            <button type="button">Edit</button>
            <button type="button">
              Split
              <ChevronDown aria-hidden />
            </button>
          </div>
          <div className="agw-doc-actions">
            <button type="button" className="agw-share-btn">
              <Share2 aria-hidden />
              Share
            </button>
            <button type="button" className="agw-icon-btn" aria-label="Settings">
              <Settings2 aria-hidden />
            </button>
          </div>
        </header>

        <div className="agw-doc-scroll">
          <article className="agw-doc-body">
            <h1>Introduction</h1>
            <p>
              Verto is a knowledge workspace for reading, writing, and acting on your information
              with precision and provenance.
            </p>
            <p>
              It is designed for analysts, researchers, and product teams who need verifiable
              answers, research agents, and purposeful knowledge.
            </p>
            <h2>What is Verto?</h2>
            <ul>
              {docBullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </main>

      {/* Column 3 — agent chat */}
      <aside className="agw-chat" aria-label="Agent">
        <header className="agw-chat-head">
          <span className="agw-chat-title">
            <span className="agw-chat-glyph">
              <Sparkles aria-hidden />
            </span>
            Agent
          </span>
          <span className="agw-chat-status">
            <span className="agw-status-dot" />
            Active
          </span>
          <button type="button" className="agw-icon-btn" aria-label="Restart">
            <RefreshCw aria-hidden />
          </button>
          <button type="button" className="agw-icon-btn" aria-label="More">
            <MoreHorizontal aria-hidden />
          </button>
        </header>

        <div className="agw-chat-scroll">
          <div className="agw-msg agw-msg--user">
            Create a summary of this doc and save it as a note. Highlight the key product principles
            in this section.
          </div>
          <div className="agw-msg agw-msg--agent">
            I&apos;ll create a summary and highlight the key principles, and save both as a note in
            this document.
          </div>

          <div className="agw-chat-block">
            <span className="agw-block-label">Context scope</span>
            <div className="agw-chip-row">
              {scopeChips.map(([label, active]) => (
                <span key={label} className={`agw-chip${active ? " is-active" : ""}`}>
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="agw-chat-block">
            <span className="agw-block-label">Suggested prompts</span>
            <div className="agw-prompt-grid">
              {suggestedPrompts.map(([label, Icon]) => (
                <button key={label} type="button" className="agw-prompt">
                  <Icon aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="agw-chat-block">
            <span className="agw-block-label">Cited sources (3)</span>
            <div className="agw-source-list">
              {citedSources.map(([title, section, tag]) => (
                <button key={title} type="button" className="agw-source">
                  <FileText aria-hidden />
                  <span className="agw-source-body">
                    <strong>
                      {title}
                      {tag ? <em className="agw-source-tag">{tag}</em> : null}
                    </strong>
                    <span>{section}</span>
                  </span>
                  <ChevronRight aria-hidden />
                </button>
              ))}
            </div>
          </div>

          <div className="agw-chat-block">
            <span className="agw-block-label">Tool steps</span>
            <ol className="agw-tool-steps">
              {toolSteps.map((name, index) => (
                <li key={name}>
                  <span className="agw-tool-num">{index + 1}</span>
                  <code>{name}</code>
                  <span className="agw-tool-ok">
                    <CheckCircle2 aria-hidden />
                    Success
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="agw-chat-composer">
          <span>Ask the agent anything…</span>
          <button type="button" className="agw-send" aria-label="Send">
            <SendHorizontal aria-hidden />
          </button>
        </div>
        <p className="agw-chat-note">
          Agent output is always grounded in sources. Writes require your explicit approval.
        </p>
      </aside>

      {/* Column 4 — multi-file write approval */}
      <aside className="agw-approve" aria-label="Agent action preview">
        <div className="agw-approve-scroll">
          <header className="agw-approve-head">
            <h2>Proposed changes</h2>
            <span className="agw-approve-badge">3 files · 2 new notes · 1 edit</span>
          </header>
          <p className="agw-approve-sub">
            The agent proposes the following changes across 3 files.
          </p>

          <div className="agw-approve-block">
            <span className="agw-block-label">Files (3)</span>
            <div className="agw-file-list">
              {proposedFiles.map(([name, meta]) => (
                <div key={name} className="agw-file">
                  <FileText aria-hidden />
                  <div>
                    <strong>{name}</strong>
                    <span>{meta}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="agw-diff-card">
            <div className="agw-diff-head">
              <strong>Product Principles.md</strong>
              <button type="button" className="agw-diff-mode">
                Unified diff
                <ChevronDown aria-hidden />
              </button>
            </div>
            <span className="agw-diff-meta">Edit · 8 additions</span>
            <pre className="agw-diff">
              {diffLines.map(([ln, text, tone]) => (
                <span key={ln} className={`agw-diff-line is-${tone}`}>
                  <b>{ln}</b>
                  <code>{text}</code>
                </span>
              ))}
            </pre>
          </div>

          <div className="agw-note-previews">
            <div className="agw-note-preview">
              <div>
                <strong>Summary — Introduction.md</strong>
                <span>Add · New note</span>
              </div>
              <button type="button">
                Preview
                <ChevronRight aria-hidden />
              </button>
            </div>
            <div className="agw-note-preview">
              <div>
                <strong>Key Takeaways.md</strong>
                <span>Add · New note</span>
              </div>
              <button type="button">
                Preview
                <ChevronRight aria-hidden />
              </button>
            </div>
          </div>

          <div className="agw-approve-block">
            <span className="agw-block-label">Rationale</span>
            <p className="agw-rationale">
              These changes capture product principles referenced in the document and align with our
              agent policies for safe, verifiable, and reversible operations.
            </p>
          </div>

          <div className="agw-approve-block">
            <span className="agw-block-label">Cited sources (3)</span>
            <div className="agw-cite-grid">
              {citedSources.map(([title, section]) => (
                <div key={title} className="agw-cite-card">
                  <strong>{title}</strong>
                  <span>{section}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="agw-approve-foot">
          <div className="agw-approve-actions">
            <button type="button" className="agw-btn-reject">
              Reject
            </button>
            <button type="button" className="agw-btn-edit">
              Edit
            </button>
            <button type="button" className="agw-btn-approve">
              <Check aria-hidden />
              Approve
            </button>
          </div>
          <p className="agw-approve-note">No changes will be applied until you approve.</p>
        </div>
      </aside>
    </section>
  );
}
