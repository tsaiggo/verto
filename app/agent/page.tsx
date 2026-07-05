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
import SpecBoardHeader from "@/components/spec-board/SpecBoardHeader";
import SpecBoardPageShell from "@/components/spec-board/SpecBoardPageShell";

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

const workflowSteps = [
  ["Idle", "Waiting for input.", "success"],
  ["Gathering context", "Collecting context based on scope.", "progress"],
  ["Searching docs", "Searching library and documents.", "progress"],
  ["Calling tools", "Executing tool calls.", "progress"],
  ["Drafting", "Synthesizing results and output.", "progress"],
  ["Waiting for approval", "Presenting proposed changes for review.", "progress"],
  ["Applying changes", "Applying approved changes to files.", "progress"],
  ["Completed / Failed", "Operation finished successfully or failed.", "failed"],
] as const;

const designPrinciples = [
  ["Agent-native", "Agents are first-class citizens in the workspace."],
  ["Explicit approval for writes", "No changes are applied without user approval."],
  ["Reversibility", "All changes are tracked and easy to undo."],
  ["Grounded in sources", "Answers and writes are backed by citations."],
  ["Context scope control", "Users control how much context agents can use."],
  ["Transparency", "Tool calls, steps, and statuses are visible."],
] as const;

const activityItems = [
  ["10:42 AM", "Create summary & highlight principles", "3 files · Approved"],
  ["9:39 AM", "Research competitor positioning", "12 sources · Completed"],
  ["4:15 PM", "Draft product positioning", "2 files · Rejected"],
  ["10:02 AM", "Find user research insights", "8 sources · Completed"],
] as const;

const pendingApprovals = [
  ["A", "Create summary & highlight principles", "3 files · Requested 2 min ago"],
  ["L", "Update roadmap timeline", "1 file · Requested 1 hour ago"],
] as const;

const followUps = [
  "Refine the summary",
  "Extract action items",
  "Create a follow-up task list",
  "Find related documents",
] as const;

const contextScopes = [
  ["Current selection", "Use only the selected text or region."],
  ["Current document", "Use the full active document."],
  ["Folder", "Use all documents in the selected folder."],
  ["Entire library", "Use all accessible documents in the library."],
] as const;

const toolKit = [
  ["get_current_doc", "Get the active document and selection."],
  ["search_doc", "Search within documents."],
  ["list_notes", "List notes in scope."],
  ["get_saved_summary", "Retrieve saved summaries."],
  ["create_highlight_note", "Create a highlight or note."],
  ["save_summary", "Save a generated summary as a note."],
] as const;

const implementationNotes = [
  "All write operations must be explicitly approved by the user.",
  "Show a clear, reviewable diff for every proposed change.",
  "Include rationale and citations for transparency and trust.",
  "All tool calls must be logged with status, input, output, and duration.",
  "Failures must be surfaced with actionable next steps.",
  "Respect the selected context scope for every operation.",
] as const;

export default function AgentPage() {
  return (
    <SpecBoardPageShell
      className="agw"
      ariaLabel="Agent Workspace and Write Approval"
      main={
        <>
          <SpecBoardHeader
            className="agw-board-header"
            brand={
              <Link href="/" className="agw-board-brand">
                <span>V</span>
                Verto
              </Link>
            }
            title="04 — Agent Workspace & Write Approval"
            description="Agent-native workspace with grounded actions, multi-file write approval, and reversible changes."
          >
            <dl>
              <div>
                <dt>Product Design Specification</dt>
                <dd>Page 04 of 04</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>May 12, 2025</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>Draft</dd>
              </div>
            </dl>
          </SpecBoardHeader>

          <div className="agw-board">
            <div className="agw-section-label agw-section-label--main">
              <span>1</span>
              <strong>Main workspace</strong>
              <em>Agent-native</em>
            </div>

            <div className="agw-main-card">
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
                      Verto is a knowledge workspace for reading, writing, and acting on your
                      information with precision and provenance.
                    </p>
                    <p>
                      It is designed for analysts, researchers, and product teams who need
                      verifiable answers, research agents, and purposeful knowledge.
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
                    Create a summary of this doc and save it as a note. Highlight the key product
                    principles in this section.
                  </div>
                  <div className="agw-msg agw-msg--agent">
                    I&apos;ll create a summary and highlight the key principles, and save both as a
                    note in this document.
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
              </aside>

              <p className="agw-main-note">
                Agent output is always grounded in sources. Writes require your explicit approval.
              </p>
            </div>

            <div className="agw-section-label agw-section-label--approve">
              <span>2</span>
              <strong>Agent action preview</strong>
              <em>Multi-file write approval</em>
            </div>

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
                    These changes capture product principles referenced in the document and align
                    with our agent policies for safe, verifiable, and reversible operations.
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

            <aside className="agw-meta" aria-label="Agent workflow and design principles">
              <section className="agw-meta-card">
                <div className="agw-section-label agw-section-label--meta">
                  <span>9</span>
                  <strong>Agent workflow</strong>
                  <em>State machine</em>
                </div>
                <ol className="agw-workflow">
                  {workflowSteps.map(([title, detail, tone], index) => (
                    <li key={title} className={`is-${tone}`}>
                      <span className="agw-workflow-num">{index + 1}</span>
                      <div>
                        <strong>{title}</strong>
                        <p>{detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="agw-legend" aria-hidden>
                  <span className="is-success">Success</span>
                  <span className="is-progress">In progress</span>
                  <span className="is-failed">Failed</span>
                </div>
              </section>

              <section className="agw-meta-card">
                <div className="agw-section-label agw-section-label--meta">
                  <span>10</span>
                  <strong>Agent design principles</strong>
                </div>
                <div className="agw-principles">
                  {designPrinciples.map(([title, detail]) => (
                    <article key={title}>
                      <Sparkles aria-hidden />
                      <div>
                        <strong>{title}</strong>
                        <p>{detail}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </aside>

            <section className="agw-spec-card agw-history">
              <div className="agw-section-label agw-section-label--meta">
                <span>3</span>
                <strong>Agent history / activity</strong>
              </div>
              <div className="agw-tabs">
                {["All", "Writes", "Reads", "Searches", "Notes"].map((tab, index) => (
                  <span key={tab} className={index === 0 ? "is-active" : ""}>
                    {tab}
                  </span>
                ))}
              </div>
              <div className="agw-history-list">
                {activityItems.map(([time, title, meta], index) => (
                  <article key={title}>
                    <i className={index === 2 ? "is-warn" : "is-ok"} />
                    <span>{time}</span>
                    <div>
                      <strong>{title}</strong>
                      <p>{meta}</p>
                    </div>
                  </article>
                ))}
              </div>
              <button type="button">View full activity</button>
            </section>

            <section className="agw-spec-card agw-pending">
              <div className="agw-section-label agw-section-label--meta">
                <span>4</span>
                <strong>Pending approval</strong>
              </div>
              <div className="agw-pending-list">
                {pendingApprovals.map(([initial, title, meta]) => (
                  <article key={title}>
                    <span>{initial}</span>
                    <div>
                      <strong>{title}</strong>
                      <p>{meta}</p>
                    </div>
                    <button type="button">Review</button>
                  </article>
                ))}
              </div>
              <button type="button">View all pending</button>
            </section>

            <section className="agw-spec-card agw-tool-detail">
              <div className="agw-section-label agw-section-label--meta">
                <span>5</span>
                <strong>Tool call detail</strong>
                <em>Popover</em>
              </div>
              <div className="agw-tool-detail-head">
                <code>search_doc</code>
                <span>Success</span>
              </div>
              <dl>
                <div>
                  <dt>Description</dt>
                  <dd>Search within the current document.</dd>
                </div>
                <div>
                  <dt>Input</dt>
                  <dd>{'{ query: "core principles", top_k: 5 }'}</dd>
                </div>
                <div>
                  <dt>Results</dt>
                  <dd>5 results</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>412 ms</dd>
                </div>
              </dl>
              <button type="button">View results</button>
            </section>

            <section className="agw-spec-card agw-follow">
              <div className="agw-section-label agw-section-label--meta">
                <span>6</span>
                <strong>Follow-up suggestions</strong>
              </div>
              <p>What would you like to do next?</p>
              {followUps.map((item) => (
                <button key={item} type="button">
                  <ChevronRight aria-hidden />
                  {item}
                </button>
              ))}
              <div className="agw-follow-input">
                <span>Ask a follow-up…</span>
                <SendHorizontal aria-hidden />
              </div>
            </section>

            <section className="agw-spec-card agw-errors">
              <div className="agw-section-label agw-section-label--meta">
                <span>7</span>
                <strong>Error states</strong>
              </div>
              <article>
                <strong>Provider unavailable</strong>
                <p>Anthropic is currently unavailable. Please try again in a few moments.</p>
                <button type="button">Retry</button>
              </article>
              <article>
                <strong>No key connected</strong>
                <p>Connect an API key to start using agents and enable write actions.</p>
                <button type="button">Connect key</button>
              </article>
            </section>

            <section className="agw-spec-card agw-permissions">
              <div className="agw-section-label agw-section-label--meta">
                <span>8</span>
                <strong>Model & permissions</strong>
                <em>In context</em>
              </div>
              <label>
                Model
                <select defaultValue="Claude 3.7 Sonnet">
                  <option>Claude 3.7 Sonnet</option>
                </select>
              </label>
              {["Read files", "Search library", "Create notes", "Edit files", "Delete files"].map(
                (item, index) => (
                  <p key={item}>
                    {item}
                    <span className={index < 3 ? "is-on" : ""} />
                  </p>
                )
              )}
              <small>Writes require approval</small>
            </section>

            <section className="agw-bottom-card agw-context-scope">
              <h3>
                Context scope <span>Detailed</span>
              </h3>
              <dl>
                {contextScopes.map(([scope, detail]) => (
                  <div key={scope}>
                    <dt>{scope}</dt>
                    <dd>{detail}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="agw-bottom-card agw-toolkit">
              <h3>
                Tool kit <span>Agent tools</span>
              </h3>
              <div>
                {toolKit.map(([tool, detail]) => (
                  <article key={tool}>
                    <CheckCircle2 aria-hidden />
                    <p>
                      <strong>{tool}</strong>
                      <span>{detail}</span>
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className="agw-bottom-card agw-implementation-notes">
              <h3>Notes for implementation</h3>
              <ul>
                {implementationNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>

            <section className="agw-bottom-card agw-data-audit">
              <h3>Data & audit</h3>
              <article>
                <Sparkles aria-hidden />
                <span>All agent activity is recorded for audit and trust.</span>
              </article>
              <article>
                <ListChecks aria-hidden />
                <span>Includes tool calls, prompts, sources, approvals, and outcomes.</span>
              </article>
              <article>
                <Settings2 aria-hidden />
                <span>Retention and access controls follow workspace settings.</span>
              </article>
            </section>

            <section className="agw-spec-card agw-undo">
              <h3>
                <span>11</span> Undo / revert confirmation
              </h3>
              <div className="agw-undo-box">
                <CheckCircle2 aria-hidden />
                <strong>Change applied</strong>
                <p>The approved changes have been successfully applied.</p>
                <button type="button">Undo last change</button>
                <button type="button">View change details</button>
                <button type="button">Done</button>
              </div>
            </section>
          </div>
        </>
      }
    />
  );
}
