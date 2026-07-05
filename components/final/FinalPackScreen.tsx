import Link from "next/link";
import type { ReactNode } from "react";
import {
  FINAL_PACK_ITEMS,
  categoryItems,
  type FinalPackItem,
} from "@/components/final/final-pack-data";

const cards = [
  ["Agent-native Workflows", "Workflow", "Roles, tools, context and guardrails.", "18 links"],
  ["Design Principles", "Principles", "Core AI product principles.", "15 links"],
  ["Product Strategy 2025", "Strategy", "Goals, positioning and bets.", "9 links"],
  ["Evaluation Framework", "Framework", "Reliability and relevance checks.", "7 links"],
  ["Competitive Landscape", "Research", "Adjacent product analysis.", "15 links"],
  ["User Research Synthesis", "Research", "Interview insights and synthesis.", "11 links"],
];

const sourceRows = [
  ["Local Library", "/Users/alex/verto", "Local", "Synced", "1,248"],
  ["Verto GitHub", "github.com/alex/verto", "Git", "Synced", "632"],
  ["Personal Notes", "OneDrive/Notes", "Cloud", "Syncing", "1,102"],
  ["Reading List", "12 RSS feeds", "Web", "Synced", "256"],
  ["Research Papers", "/Users/alex/papers", "Local", "Pending", "98"],
  ["Work Docs", "gitlab.com/acme/docs", "Git", "Error", "--"],
];

const gitFiles = [
  ["docs/agent-workflow.mdx", "M", "+24 -6"],
  ["components/Callout.tsx", "M", "+12 -2"],
  ["assets/diagram.svg", "A", "+18"],
  ["README.md", "M", "+8 -1"],
];

const referenceNav = [
  ["Home", "⌂"],
  ["Inbox", "▣", "6"],
  ["Library", "▤"],
  ["Collections", "□"],
  ["Tags", "◇"],
  ["Bookmarks", "♡"],
  ["Graph", "◌"],
  ["Agent", "✦"],
  ["Knowledge Studio", "⌘"],
  ["Activity", "◉"],
];

function isReader(item: FinalPackItem) {
  return item.category === "Reader" || item.category === "Reader & Annotation";
}

function isEditor(item: FinalPackItem) {
  return item.category === "Editor" || item.category === "Editor & MDX Authoring";
}

function Header({ item, actions }: { item: FinalPackItem; actions?: ReactNode }) {
  return (
    <header className="final-head">
      <div>
        <p className="final-kicker">
          {item.category} / {item.state} / Board {item.sourceBoard}
        </p>
        <h1>{item.title}</h1>
        <p>{item.notes}</p>
      </div>
      {actions ? <div className="final-actions">{actions}</div> : null}
    </header>
  );
}

function Tabs({ labels, active = 0 }: { labels: string[]; active?: number }) {
  return (
    <div className="final-tabs" role="tablist">
      {labels.map((label, index) => (
        <span key={label} className={`final-tab${index === active ? " is-active" : ""}`}>
          {label}
        </span>
      ))}
    </div>
  );
}

function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`final-card ${className}`}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}

function ReferenceStage({
  children,
  tone = "light",
}: {
  children: ReactNode;
  tone?: "light" | "dark" | "device";
}) {
  return <div className={`final-reference-stage is-${tone}`}>{children}</div>;
}

function ReferenceShell({
  active = "Home",
  dark = false,
  children,
}: {
  active?: string;
  dark?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`final-ref-page${dark ? " is-dark" : ""}`}>
      <aside className="final-ref-sidebar">
        <div className="final-ref-brand">
          <span>V</span>
          <strong>verto</strong>
        </div>
        <nav className="final-ref-nav" aria-label="Reference navigation">
          {referenceNav.map(([label, icon, badge], index) => (
            <span
              key={label}
              className={`${label === active ? "is-active " : ""}${index === 7 ? "has-separator" : ""}`}
            >
              <i>{icon}</i>
              <b>{label}</b>
              {badge ? <small>{badge}</small> : null}
            </span>
          ))}
        </nav>
        <div className="final-ref-spacer" />
        <span className="final-ref-settings">
          <i>⚙</i>
          <b>Settings</b>
        </span>
        <div className="final-ref-profile">
          <em>AC</em>
          <span>
            <strong>Alex Chen</strong>
            <small>Pro plan</small>
          </span>
          <b>⌄</b>
        </div>
      </aside>
      <main className="final-ref-main">
        <div className="final-ref-topbar">
          <span />
          <div className="final-ref-top-actions">
            <div className="final-ref-search">
              ⌕&nbsp;&nbsp;Search Verto <kbd>⌘ K</kbd>
            </div>
            <button type="button" aria-label="Toggle theme">
              ☼
            </button>
            <button type="button" aria-label="Focus">
              ♢
            </button>
            <button type="button" aria-label="More">
              ⋮
            </button>
          </div>
        </div>
        <div className="final-ref-content">{children}</div>
      </main>
    </div>
  );
}

function MiniLibraryContent() {
  return (
    <>
      <h1>Library</h1>
      <p className="final-ref-muted">All your connected sources and documents.</p>
      <section className="final-ref-card">
        <h2>Recent documents</h2>
        {[
          ["Agent-native Workflows.mdx", "1h ago"],
          ["Key Features.mdx", "2h ago"],
          ["Designing AI Products.md", "3h ago"],
          ["Research Notes.md", "4h ago"],
        ].map(([title, time]) => (
          <div key={title} className="final-ref-row">
            <span>{title}</span>
            <small>{time}</small>
          </div>
        ))}
      </section>
    </>
  );
}

function ResponsiveDeviceSurface({ item }: { item: FinalPackItem }) {
  const device = item.id.includes("mobile")
    ? "mobile"
    : item.id.includes("tablet")
      ? "tablet"
      : "desktop";
  return (
    <ReferenceStage tone="device">
      <div className={`final-device is-${device}`}>
        <div className="final-device-header">
          <strong>Verto</strong>
          <span>⌕ &nbsp; ☼ &nbsp; ⋮</span>
        </div>
        <div className="final-device-body">
          <aside className="final-device-side">
            {["Home", "Inbox", "Library", "Collections", "Agent", "Settings"].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </aside>
          <main className="final-device-content">
            <MiniLibraryContent />
          </main>
        </div>
      </div>
    </ReferenceStage>
  );
}

function DarkReaderSurface() {
  return (
    <ReferenceStage tone="dark">
      <ReferenceShell active="Library" dark>
        <div className="final-ref-reader-layout">
          <aside className="final-ref-tree">
            <h2>Sources</h2>
            {[
              "▾ Agent-native Workflows",
              "◫ Introduction.mdx",
              "◫ Why Verto?.mdx",
              "◫ Key Features.mdx",
              "◫ How to Use.mdx",
            ].map((row, index) => (
              <span key={row} className={index === 1 ? "is-active" : ""}>
                {row}
              </span>
            ))}
            <h2>Collections</h2>
            {["□ Product", "□ Engineering", "□ Research", "□ Design"].map((row) => (
              <span key={row}>{row}</span>
            ))}
          </aside>
          <article className="final-ref-reader">
            <div className="final-ref-mode">
              <span className="is-active">Read</span>
              <span>Edit</span>
              <span>Split</span>
            </div>
            <div className="final-ref-reader-inner">
              <h1>Introduction</h1>
              <div className="final-ref-callout">
                Verto is a local-first knowledge workspace for reading, writing and thinking with
                the help of AI agents.
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
              </ul>
              <h2>The Verto Workflow</h2>
              <div className="final-ref-workflow">
                {["Capture", "Read", "Understand", "Create", "Connect"].map((step, index) => (
                  <span key={step}>
                    <b>{index + 1}</b>
                    {step}
                  </span>
                ))}
              </div>
            </div>
          </article>
          <aside className="final-ref-rail">
            <div className="final-ref-tabs">
              {["Outline", "Notes", "Links", "Agent"].map((tab, index) => (
                <span key={tab} className={index === 0 ? "is-active" : ""}>
                  {tab}
                </span>
              ))}
            </div>
            <strong>Introduction</strong>
            {[
              "What is Verto?",
              "The Verto Workflow",
              "Core Principles",
              "Why MDX?",
              "Who is it for?",
            ].map((row, index) => (
              <p key={row} className={index > 0 ? "is-indent" : ""}>
                {row}
              </p>
            ))}
            <div className="final-ref-card">
              <h2>Assistant Summary</h2>
              <p>
                Verto combines reading, writing, and grounded AI workflows in one local-first
                workspace.
              </p>
            </div>
          </aside>
        </div>
      </ReferenceShell>
    </ReferenceStage>
  );
}

function HomeReferenceContent({ overlay }: { overlay?: ReactNode }) {
  return (
    <div className="final-ref-home">
      <div className="final-ref-section-head">
        <div>
          <h1>Good morning, Alex.</h1>
          <p>Here’s what’s happening in your knowledge workspace.</p>
        </div>
        <div className="final-ref-actions">
          <button type="button" className="is-primary">
            + New
          </button>
          <button type="button">✦ Ask Agent</button>
        </div>
      </div>
      <div className="final-ref-grid is-three">
        {[
          ["Continue Reading", "Agent-native Workflows.mdx", "Designing AI Products.mdx"],
          ["Recent Edits", "Key Features.mdx", "Agent Workflow.mdx"],
          ["Agent Highlights", "Summarized 4 documents", "Created 2 knowledge cards"],
        ].map(([title, first, second]) => (
          <section key={title} className="final-ref-card">
            <h2>{title}</h2>
            <div className="final-ref-row">
              <span>
                <strong>{first}</strong>
                <small>
                  {title === "Continue Reading"
                    ? "Last read 2 min ago"
                    : title === "Recent Edits"
                      ? "Edited 10m ago"
                      : "2 hours ago"}
                </small>
              </span>
              <small>{title === "Continue Reading" ? "42%" : "›"}</small>
            </div>
            <div className="final-ref-row">
              <span>
                <strong>{second}</strong>
                <small>
                  {title === "Continue Reading"
                    ? "Last read yesterday"
                    : title === "Recent Edits"
                      ? "Edited 1h ago"
                      : "Yesterday"}
                </small>
              </span>
              <small>{title === "Continue Reading" ? "31%" : "›"}</small>
            </div>
            {title !== "Continue Reading" ? (
              <div className="final-ref-row">
                <span>
                  <strong>
                    {title === "Recent Edits"
                      ? "Knowledge Graph Ideas.md"
                      : "Connected 6 related ideas"}
                  </strong>
                  <small>{title === "Recent Edits" ? "Edited 2h ago" : "Yesterday"}</small>
                </span>
                <small>›</small>
              </div>
            ) : null}
          </section>
        ))}
      </div>
      <div className="final-ref-grid is-dashboard">
        <section className="final-ref-card">
          <h2>Knowledge Activity</h2>
          <div className="final-ref-heatmap">
            {Array.from({ length: 154 }, (_, i) => (
              <span key={i} className={`l${(i * 7) % 5}`} />
            ))}
          </div>
        </section>
        <section className="final-ref-card">
          <h2>This Week</h2>
          <strong className="final-ref-metric">3h 42m</strong>
          <div className="final-ref-row">
            <span>Documents edited</span>
            <b>4</b>
          </div>
          <div className="final-ref-row">
            <span>Notes captured</span>
            <b>12</b>
          </div>
        </section>
        <section className="final-ref-card">
          <h2>Inbox / Triage</h2>
          {[
            ["5 highlights without notes", "Notes"],
            ["3 documents need summary", "Local"],
            ["2 unresolved agent questions", "Agent"],
            ["1 source needs attention", "Sync"],
          ].map(([row, tag]) => (
            <div key={row} className="final-ref-row">
              <span>{row}</span>
              <small className="final-ref-pill">{tag}</small>
            </div>
          ))}
        </section>
      </div>
      <section className="final-ref-card final-ref-collections">
        <div className="final-ref-section-head">
          <h2>Recent Collections</h2>
          <a>View all collections →</a>
        </div>
        <div className="final-ref-collection-row">
          {[
            ["AI & Agents", "24 documents"],
            ["Product Design", "18 documents"],
            ["Writing", "35 documents"],
            ["Research", "54 documents"],
          ].map(([title, meta]) => (
            <div key={title} className="final-ref-card">
              <strong>{title}</strong>
              <p className="final-ref-muted">{meta}</p>
            </div>
          ))}
        </div>
      </section>
      {overlay}
    </div>
  );
}

function KeyboardShortcutsSurface() {
  return (
    <ReferenceStage>
      <ReferenceShell active="Home">
        <HomeReferenceContent
          overlay={
            <div className="final-ref-backdrop">
              <div className="final-ref-modal">
                <div className="final-ref-section-head">
                  <h2>Keyboard Shortcuts</h2>
                  <button type="button">×</button>
                </div>
                <div className="final-ref-input">Search shortcuts…</div>
                <div className="final-ref-kbd-list">
                  {[
                    ["Command Palette", "⌘ K"],
                    ["Quick Open", "⌘ P"],
                    ["Toggle Sidebar", "⌘ /"],
                    ["Global Search", "⌘ F"],
                    ["Save", "⌘ S"],
                    ["Left / Right Split", "⌘ ⇧ \\"],
                    ["Ask Agent", "⌘ Enter"],
                  ].map(([label, key]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <kbd>{key}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          }
        />
      </ReferenceShell>
    </ReferenceStage>
  );
}

const mdxLines = [
  "  1  ---",
  "  2  title: Agent-native Workflows",
  "  3  description: Designing knowledge work that thinks with you.",
  "  4  status: published",
  "  5  tags: [agent, workflows, design]",
  "  6  ---",
  "  7",
  "  8  # Agent-native Workflows",
  "  9",
  " 10  Designing knowledge work that thinks with you.",
  " 11",
  ' 12  <Callout type="info" title="Core Idea">',
  " 13    Give the agent context, not just questions.",
  " 14  </Callout>",
  " 15",
  " 16  ## What is Agent-native?",
  " 17",
  " 18  Agent-native means the agent is more than a chatbot.",
  " 19  It understands your workspace, your tools, and your goals.",
];

function SplitEditorContent({ overlay }: { overlay?: ReactNode }) {
  return (
    <>
      <div className="final-ref-mode">
        <span>Read</span>
        <span>Edit</span>
        <span className="is-active">Split</span>
      </div>
      <div className="final-ref-editor-split">
        <section className="final-ref-card is-editor">
          <div className="final-ref-editor-toolbar">
            Agent-native Workflows.mdx <span>MDX ▾</span>
          </div>
          <pre>{mdxLines.join("\n")}</pre>
        </section>
        <section className="final-ref-card is-preview">
          <h1>Agent-native Workflows</h1>
          <p>Designing knowledge work that thinks with you.</p>
          <div className="final-ref-callout">
            <strong>Core Idea</strong>
            <br />
            Give the agent context, not just questions.
          </div>
          <h2>What is Agent-native?</h2>
          <p>
            Agent-native means the agent is more than a chatbot. It understands your workspace, your
            tools, and your goals.
          </p>
          <h2>Core Principles</h2>
          <ol>
            <li>Context is everything</li>
            <li>Reasoning is visible</li>
            <li>Actions are safe</li>
            <li>You stay in control</li>
          </ol>
        </section>
      </div>
      {overlay}
    </>
  );
}

function EditorReferenceSurface({ item }: { item: FinalPackItem }) {
  const isCommand = item.id.includes("command-palette");
  return (
    <ReferenceStage>
      <ReferenceShell active="Library">
        <SplitEditorContent
          overlay={
            <div className="final-ref-backdrop">
              <div className="final-ref-modal">
                {isCommand ? (
                  <>
                    <div className="final-ref-section-head">
                      <h2>Command Palette</h2>
                      <button type="button">×</button>
                    </div>
                    <div className="final-ref-input">Type a command…</div>
                    {[
                      ["Format Document", ""],
                      ["Fix All Problems", ""],
                      ["Insert Table", ""],
                      ["Insert Callout", ""],
                      ["Toggle Split View", "⌘ \\"],
                      ["Go to Symbol", "⌘ T"],
                      ["Find in Files", "⌘ ⇧ F"],
                    ].map(([label, shortcut]) => (
                      <div key={label} className="final-ref-row">
                        <span>{label}</span>
                        <small>{shortcut}</small>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="final-ref-section-head">
                      <h2>New</h2>
                      <button type="button">×</button>
                    </div>
                    <div className="final-ref-tabs">
                      <span className="is-active">Document</span>
                      <span>Folder</span>
                    </div>
                    {[
                      ["Name", "new-document.mdx"],
                      ["Location", "Verto Handbook / Editor Mode"],
                      ["Template", "Standard MDX ▾"],
                    ].map(([label, value]) => (
                      <label key={label} className="final-ref-field">
                        <span>{label}</span>
                        <div>{value}</div>
                      </label>
                    ))}
                    <div className="final-ref-actions is-end">
                      <button type="button">Cancel</button>
                      <button type="button" className="is-primary">
                        Create
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          }
        />
      </ReferenceShell>
    </ReferenceStage>
  );
}

function specialReferenceSurface(item: FinalPackItem): ReactNode | null {
  if (
    item.id === "12_responsive-desktop" ||
    item.id === "13_responsive-tablet" ||
    item.id === "14_responsive-mobile"
  ) {
    return <ResponsiveDeviceSurface item={item} />;
  }
  if (item.id === "19_dark-mode-preview") return <DarkReaderSurface />;
  if (item.id === "20_keyboard-shortcuts") return <KeyboardShortcutsSurface />;
  if (item.id === "46_editor-new-document" || item.id === "48_editor-command-palette") {
    return <EditorReferenceSurface item={item} />;
  }
  return null;
}

function Related({ item }: { item: FinalPackItem }) {
  const peers = categoryItems(item.category)
    .filter((peer) => peer.id !== item.id)
    .slice(0, 6);
  return (
    <aside className="final-related" aria-label="Related references">
      <strong>Related final states</strong>
      {peers.map((peer) => (
        <Link key={peer.id} href={`/final/${peer.id}`}>
          <span>{peer.title}</span>
          <small>{peer.state}</small>
        </Link>
      ))}
    </aside>
  );
}

function KnowledgeSurface({ item }: { item: FinalPackItem }) {
  const detail = item.id.includes("detail") || item.id.includes("digest");
  return (
    <>
      <Header
        item={item}
        actions={
          <>
            <button className="final-btn">Import</button>
            <button className="final-btn final-btn-primary">New Card</button>
          </>
        }
      />
      <Tabs
        labels={["Cards", "Templates", "Insights", "Drafts"]}
        active={item.id.includes("digest") ? 2 : 0}
      />
      {detail ? (
        <div className="final-two">
          <Card title={item.title}>
            <p className="final-lede">
              A reusable knowledge object grounded in source documents, notes and agent-generated
              summaries. Every claim keeps provenance visible.
            </p>
            <div className="final-stack">
              {["Source passages", "Agent summary", "Linked decisions", "Open questions"].map(
                (row) => (
                  <div key={row} className="final-row">
                    <span>
                      <strong>{row}</strong>
                      <small>Updated today by Alex Chen</small>
                    </span>
                    <span className="final-pill">Linked</span>
                  </div>
                )
              )}
            </div>
          </Card>
          <Card title="Provenance">
            <div className="final-stack compact">
              {[
                "Agent-native Workflows.mdx",
                "Design Principles.mdx",
                "User Research Synthesis.md",
              ].map((row, index) => (
                <div key={row} className="final-row">
                  <span>
                    <strong>{row}</strong>
                    <small>
                      Source {index + 1} / paragraph {index + 4}
                    </small>
                  </span>
                  <span>{index + 1}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <div className="final-card-grid">
          {cards.map(([title, kind, desc, meta]) => (
            <Card key={title}>
              <span className="final-pill">{kind}</span>
              <h2>{title}</h2>
              <p>{desc}</p>
              <small>{meta}</small>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function ReaderSurface({ item }: { item: FinalPackItem }) {
  const state = item.id;
  const loading = state.includes("loading");
  const failed = state.includes("failed");
  const focus = state.includes("focus");
  return (
    <div className={`final-reader-shell${focus ? " is-focus" : ""}`}>
      {!focus ? (
        <aside className="final-doc-tree">
          <strong>AI & Agents</strong>
          {["01 Introduction.mdx", "02 Agent-native Workflows.mdx", "03 Evaluation.mdx"].map(
            (doc, i) => (
              <span key={doc} className={i === 1 ? "is-active" : ""}>
                {doc}
              </span>
            )
          )}
        </aside>
      ) : null}
      <article className="final-reader-doc">
        {loading ? (
          <div className="final-skeleton-text" aria-label="Loading reader">
            {Array.from({ length: 14 }, (_, i) => (
              <span key={i} style={{ width: `${92 - (i % 4) * 13}%` }} />
            ))}
          </div>
        ) : failed ? (
          <div className="final-state-card">
            <span className="final-state-icon">!</span>
            <h2>Failed to render MDX</h2>
            <p>Unknown component `AgentDiagram` could not be resolved.</p>
            <button className="final-btn final-btn-primary">Open Problems</button>
          </div>
        ) : (
          <>
            <p className="final-kicker">AI & Agents / 02 Agent-native Workflows.mdx</p>
            <h1>Agent-native Workflows</h1>
            <p className="final-lede">
              Verto keeps reading, writing and agent output grounded in the same source document.
              Selections become reusable notes, citations and approved changes.
            </p>
            <p>
              The workflow starts with context. The document remains the primary visual object while
              side rails expose outline, notes, links and agent actions.
            </p>
            <blockquote>
              Agents can propose changes, but the user keeps explicit control over every write.
            </blockquote>
            <h2>Core principles</h2>
            <p>
              Grounded context, reversible actions and transparent provenance form the trust layer
              for every AI interaction in Verto.
            </p>
            {state.includes("selection") || state.includes("note-popover") ? (
              <div className="final-selection-pop">
                <strong>Summarize</strong>
                <span>Add note</span>
                <span>Ask Agent</span>
                <span>Copy citation</span>
              </div>
            ) : null}
            {state.includes("note-popover") ? (
              <div className="final-note-pop">
                <strong>Add note</strong>
                <textarea defaultValue="This passage defines the approval boundary for agent writes." />
                <button className="final-btn final-btn-primary">Save note</button>
              </div>
            ) : null}
          </>
        )}
      </article>
      {!focus ? (
        <aside className="final-context-rail">
          <Tabs labels={["Outline", "Notes", "Links", "Agent"]} active={railTab(item)} />
          <div className="final-stack compact">
            {railRows(item).map((row) => (
              <div key={row} className="final-row">
                <span>
                  <strong>{row}</strong>
                  <small>Grounded in this document</small>
                </span>
              </div>
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function railTab(item: FinalPackItem) {
  if (item.id.includes("notes")) return 1;
  if (item.id.includes("backlinks")) return 2;
  if (item.id.includes("agent")) return 3;
  return 0;
}

function railRows(item: FinalPackItem) {
  if (item.id.includes("backlinks"))
    return ["Product Strategy", "Evaluation Framework", "RAG Notes"];
  if (item.id.includes("agent"))
    return ["Summary with citations", "Open questions", "Suggested follow-up"];
  if (item.id.includes("notes"))
    return ["Approval boundary", "Context capture", "Reusable insight"];
  return ["Introduction", "Core principles", "Approval flow", "Evaluation"];
}

function EditorSurface({ item }: { item: FinalPackItem }) {
  return (
    <div className="final-editor-shell">
      <aside className="final-doc-tree">
        <strong>Verto Handbook</strong>
        {["01 Introduction", "02 Key Concepts", "03 Editor Mode", "callout.mdx", "tabs.mdx"].map(
          (doc, i) => (
            <span key={doc} className={i === 2 ? "is-active" : ""}>
              {doc}
            </span>
          )
        )}
      </aside>
      <section className="final-editor-main">
        <Tabs labels={["Read", "Edit", "Split"]} active={item.id.includes("split") ? 2 : 1} />
        <div className="final-editor-tabs">
          <span>getting-started.mdx</span>
          <span className="is-active">editor-mode.mdx*</span>
          <span>callout.mdx</span>
        </div>
        <div className="final-code">
          {[
            "---",
            "title: Editor Mode",
            "tags: [mdx, authoring, components]",
            "---",
            "",
            "# Editor Mode",
            "",
            "Use Edit mode to author documents with speed and confidence.",
            "",
            '<Callout type="info" title="Live by default">',
            "  Every change updates the preview instantly.",
            "</Callout>",
          ].map((line, index) => (
            <div key={`${line}-${index}`}>
              <span>{index + 1}</span>
              <code>{line || " "}</code>
            </div>
          ))}
        </div>
        {editorOverlay(item)}
      </section>
      <aside className="final-preview">
        <h2>Editor Mode</h2>
        <p>Author rich MDX, preview components and keep problems visible.</p>
        <div className="final-callout">Live preview updates as the source changes.</div>
      </aside>
    </div>
  );
}

function editorOverlay(item: FinalPackItem) {
  if (item.id.includes("component-inserter")) {
    return (
      <div className="final-floating-menu">
        {["Callout", "Tabs", "Mermaid", "Table"].map((v) => (
          <span key={v}>{v}</span>
        ))}
      </div>
    );
  }
  if (item.id.includes("problems")) {
    return (
      <div className="final-bottom-panel">
        3 problems: unknown prop, missing alt text, invalid heading order.
      </div>
    );
  }
  if (item.id.includes("save-failed")) {
    return <div className="final-toast is-error">Save failed. Retry or save a copy.</div>;
  }
  if (item.id.includes("version-history")) {
    return <div className="final-side-pop">Version history: 2m ago, 1h ago, yesterday.</div>;
  }
  if (item.id.includes("new-document")) {
    return (
      <div className="final-modal">
        <h2>New document</h2>
        <input defaultValue="agent-native-workflows.mdx" />
        <button className="final-btn final-btn-primary">Create</button>
      </div>
    );
  }
  if (item.id.includes("context-menu")) {
    return (
      <div className="final-floating-menu is-small">
        {["Rename", "Move", "Duplicate", "Delete"].map((v) => (
          <span key={v}>{v}</span>
        ))}
      </div>
    );
  }
  if (item.id.includes("command-palette")) {
    return (
      <div className="final-modal">
        <h2>Command palette</h2>
        <input defaultValue="Insert component" />
        <p>Open file, Toggle split, Run agent summary</p>
      </div>
    );
  }
  if (item.id.includes("unsaved")) {
    return <div className="final-toast">Unsaved changes. Autosave paused.</div>;
  }
  return null;
}

function AgentSurface({ item }: { item: FinalPackItem }) {
  const error = item.state === "Error" || item.state === "Blocked";
  const approval =
    item.state.includes("Approval") || item.id.includes("approval") || item.id.includes("changes");
  return (
    <>
      <Header item={item} />
      <div className="final-agent-shell">
        <aside className="final-doc-tree">
          <button className="final-btn final-btn-primary">New Chat</button>
          {["Summarize workflows", "Compare RAG", "Pending approvals", "Provider status"].map(
            (row, i) => (
              <span key={row} className={i === 0 ? "is-active" : ""}>
                {row}
              </span>
            )
          )}
        </aside>
        <section className="final-chat">
          <div className="final-bubble is-user">
            What are the core principles behind agent-native workflows?
          </div>
          <div className={`final-bubble is-agent${error ? " is-error" : ""}`}>
            {error
              ? "The selected provider is unavailable. Non-AI reading and editing stay available."
              : "Here are the grounded principles with cited sources and reversible next actions."}
          </div>
          {approval ? <ApprovalPreview /> : <RunTimeline item={item} />}
          <div className="final-composer">Ask anything about this workspace...</div>
        </section>
        <aside className="final-context-rail">
          <h2>Context</h2>
          {["Agent-native Workflows.mdx", "Key Features.mdx", "Evaluation Framework.md"].map(
            (row) => (
              <div key={row} className="final-row">
                <span>
                  <strong>{row}</strong>
                  <small>Active source</small>
                </span>
              </div>
            )
          )}
        </aside>
      </div>
    </>
  );
}

function ApprovalPreview() {
  return (
    <Card title="Write approval required">
      <div className="final-diff">
        <span>### Monitoring</span>
        <span className="del">- Track accuracy and latency.</span>
        <span className="add">+ Track accuracy, latency, and tool success rate.</span>
        <span className="add">+ Use dashboards to detect drift and anomalies.</span>
      </div>
      <div className="final-actions right">
        <button className="final-btn">Reject</button>
        <button className="final-btn final-btn-primary">Approve</button>
      </div>
    </Card>
  );
}

function RunTimeline({ item }: { item: FinalPackItem }) {
  const done = item.state.includes("Success") || item.state === "Partial Success";
  return (
    <div className="final-timeline">
      {[
        "Gather context",
        "Search files",
        "Call tools",
        "Draft answer",
        "Apply approved changes",
      ].map((row, i) => (
        <div key={row} className={done || i < 3 ? "is-done" : "is-running"}>
          <span />
          <strong>{row}</strong>
          <small>{i < 3 ? "Complete" : "In progress"}</small>
        </div>
      ))}
    </div>
  );
}

function SourcesSurface({ item }: { item: FinalPackItem }) {
  const git =
    item.id.includes("git") || item.id.includes("conflict") || item.id.includes("branches");
  if (git) return <GitSurface item={item} />;
  const step = Number(item.id.match(/(\d+)_add-source/)?.[1] ?? 58) - 58;
  return (
    <>
      <Header
        item={item}
        actions={<button className="final-btn final-btn-primary">Add Source</button>}
      />
      <Tabs
        labels={["Overview", "Connect", "Configure", "Select Content", "Sync", "Done"]}
        active={Math.max(0, Math.min(step, 5))}
      />
      {item.id.includes("add-source") ? (
        <div className="final-card-grid">
          {["Local Folder", "GitHub", "OneDrive", "Web / RSS", "Import Files", "Notion"].map(
            (name) => (
              <Card key={name}>
                <h2>{name}</h2>
                <p>Connect {name.toLowerCase()} as a grounded Verto source.</p>
                <button className="final-btn">Select</button>
              </Card>
            )
          )}
        </div>
      ) : (
        <div className="final-table">
          {sourceRows.map(([name, path, type, status, count]) => (
            <div key={name} className="final-table-row">
              <strong>{name}</strong>
              <span>{path}</span>
              <span>{type}</span>
              <span className={`final-pill is-${status.toLowerCase()}`}>{status}</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function GitSurface({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header item={item} />
      <Tabs
        labels={["Changes 8", "Diff", "Commit", "Branches", "Conflicts"]}
        active={gitTab(item)}
      />
      <div className="final-two">
        <Card title="Changed files">
          {gitFiles.map(([file, badge, count]) => (
            <div key={file} className="final-row">
              <span>
                <strong>{file}</strong>
                <small>{count}</small>
              </span>
              <span className="final-pill">{badge}</span>
            </div>
          ))}
        </Card>
        <Card title={item.title}>
          <div className="final-split-diff">
            <div className="final-diff">
              <span>Current</span>
              <span className="del">- Capture context</span>
              <span>- Propose actions</span>
            </div>
            <div className="final-diff">
              <span>Working directory</span>
              <span className="add">+ Capture context</span>
              <span className="add">+ Require approval</span>
              <span>+ Apply safely</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

function gitTab(item: FinalPackItem) {
  if (item.id.includes("diff")) return 1;
  if (item.id.includes("commit")) return 2;
  if (item.id.includes("branches")) return 3;
  if (item.id.includes("conflict")) return 4;
  return 0;
}

function SettingsSurface({ item }: { item: FinalPackItem }) {
  const sections = [
    "General",
    "Appearance",
    "Editor",
    "Reading",
    "AI & Agent",
    "Privacy",
    "Shortcuts",
    "About",
  ];
  const active = Math.max(
    0,
    sections.findIndex((label) =>
      item.title.toLowerCase().includes(label.split(" ")[0].toLowerCase())
    )
  );
  return (
    <>
      <Header item={item} />
      <div className="final-settings">
        <nav>
          {sections.map((section, i) => (
            <span key={section} className={i === active ? "is-active" : ""}>
              {section}
            </span>
          ))}
        </nav>
        <div>
          <Card title={sections[active]}>
            <div className="final-stack">
              {[
                "Workspace behavior",
                "Default source",
                "Keyboard-first commands",
                "Local data ownership",
              ].map((row, i) => (
                <div key={row} className="final-row">
                  <span>
                    <strong>{row}</strong>
                    <small>{item.notes}</small>
                  </span>
                  <span className={`final-switch${i % 2 === 0 ? " is-on" : ""}`} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function StateSurface({ item }: { item: FinalPackItem }) {
  const loading = item.state === "Loading" || item.state === "Progress";
  return (
    <>
      <Header item={item} />
      <div className="final-state-layout">
        <div className="final-state-card">
          <span className="final-state-icon">{stateIcon(item)}</span>
          <h2>{item.title}</h2>
          <p>{item.notes}</p>
          {loading ? (
            <div className="final-progress">
              <span style={{ width: item.state === "Progress" ? "62%" : "42%" }} />
            </div>
          ) : null}
          <div className="final-actions">
            <button className="final-btn">Learn more</button>
            <button className="final-btn final-btn-primary">{primaryStateAction(item)}</button>
          </div>
        </div>
        <Card title="What stays available">
          <div className="final-stack compact">
            {[
              "Local reading",
              "Search cached documents",
              "Open recent files",
              "Manage settings",
            ].map((row) => (
              <div key={row} className="final-row">
                <span>
                  <strong>{row}</strong>
                  <small>Available offline or locally</small>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function stateIcon(item: FinalPackItem) {
  if (item.state === "Error" || item.state === "Blocked") return "!";
  if (item.state === "Warning") return "?";
  if (item.state === "Loading" || item.state === "Progress") return "...";
  if (item.state.includes("Step")) return ">";
  return "+";
}

function primaryStateAction(item: FinalPackItem) {
  if (item.id.includes("onboarding")) return "Continue";
  if (item.state === "Error") return "Retry";
  if (item.state === "Blocked") return "Reconnect";
  if (item.state === "Warning") return "Open anyway";
  return "Take action";
}

function FoundationSurface({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header item={item} />
      <div className="final-card-grid">
        {["Color tokens", "Typography", "Spacing", "Radius", "Shell regions", "States"].map(
          (title, index) => (
            <Card key={title} title={title}>
              <p>{item.notes}</p>
              <div className="final-token-row">
                <span style={{ background: index % 2 ? "#15191f" : "#fafafa" }} />
                <span style={{ background: "#ffffff" }} />
                <span style={{ background: "#e6e6e2" }} />
                <span style={{ background: "#2563eb" }} />
              </div>
            </Card>
          )
        )}
      </div>
    </>
  );
}

function GenericSurface({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header item={item} />
      <div className="final-two">
        <Card title="Reference coverage">
          <p className="final-lede">{item.notes}</p>
          <div className="final-stack">
            {["Primary view", "State handling", "Actions", "Responsive behavior"].map((row) => (
              <div key={row} className="final-row">
                <span>
                  <strong>{row}</strong>
                  <small>{item.state}</small>
                </span>
                <span className="final-pill">Covered</span>
              </div>
            ))}
          </div>
        </Card>
        <Related item={item} />
      </div>
    </>
  );
}

export default function FinalPackScreen({
  item,
  showRelated = true,
}: {
  item: FinalPackItem;
  showRelated?: boolean;
}) {
  const special = specialReferenceSurface(item);
  if (special) {
    return (
      <main className="final-page final-page-reference" aria-label={item.title}>
        {special}
      </main>
    );
  }

  let body: ReactNode;
  if (isReader(item)) body = <ReaderSurface item={item} />;
  else if (isEditor(item)) body = <EditorSurface item={item} />;
  else if (item.category === "Agent") body = <AgentSurface item={item} />;
  else if (item.category === "Sources & Git") body = <SourcesSurface item={item} />;
  else if (item.category === "Settings") body = <SettingsSurface item={item} />;
  else if (item.category === "Onboarding & States") body = <StateSurface item={item} />;
  else if (
    item.category === "Foundation" ||
    item.category === "Responsive" ||
    item.category === "Mobile"
  )
    body = <FoundationSurface item={item} />;
  else if (item.category === "Library & Knowledge") body = <KnowledgeSurface item={item} />;
  else body = <GenericSurface item={item} />;

  return (
    <main className="final-page" aria-label={item.title}>
      {body}
      {showRelated && !["Reader", "Editor", "Agent"].includes(item.category) ? null : null}
    </main>
  );
}

export function FinalPackIndex() {
  const groups = Array.from(new Set(FINAL_PACK_ITEMS.map((item) => item.category)));
  return (
    <main className="final-page final-index">
      <Header
        item={{
          id: "final-index",
          title: "Final Implementation Pack",
          category: "Coverage",
          state: "92 references",
          sourceBoard: "00-07",
          notes: "Every reference screen has a route-backed Verto surface for final verification.",
        }}
      />
      {groups.map((group) => (
        <section key={group} className="final-index-group">
          <h2>{group}</h2>
          <div className="final-index-grid">
            {FINAL_PACK_ITEMS.filter((item) => item.category === group).map((item) => (
              <Link key={item.id} href={`/final/${item.id}`} className="final-index-card">
                <span>{item.id.split("_")[0]}</span>
                <strong>{item.title}</strong>
                <small>{item.state}</small>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
