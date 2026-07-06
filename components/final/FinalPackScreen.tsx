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
  const isError = item.state === "Error" || item.state === "Blocked";
  const isApproval =
    item.state.includes("Approval") || item.id.includes("approval") || item.id.includes("changes");
  const isPermissions = item.id.includes("permissions");
  const isPending = item.id.includes("pending-approvals");
  const isTool = item.id.includes("tool-call");
  const isPartial = item.id.includes("partial");
  const isApplied = item.id.includes("applied");
  const isRunning = item.id.includes("run-in-progress");

  // Fine-grained agent settings surface (57)
  if (isPermissions) {
    return (
      <>
        <Header item={item} />
        <div className="final-two">
          <Card title="Model & permissions">
            <div className="final-stack compact">
              {[
                ["Model", "GPT-5.5", "medium"],
                ["Provider", "GitHub Copilot", "connected"],
                ["Temperature", "0.2", "conservative"],
                ["Max tokens", "8192", ""],
                ["System prompt", "Custom", "editable"],
              ].map(([label, value, hint]) => (
                <div key={label} className="final-row">
                  <span>
                    <strong>{label}</strong>
                    <small>{value}</small>
                  </span>
                  <span className="final-pill">{hint || "OK"}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Tool permissions">
            <div className="final-stack compact">
              {[
                ["Read files", true, "Any file in your workspace"],
                ["Search library", true, "Grep, tags, backlinks"],
                ["Fetch web", false, "Ask before every request"],
                ["Write files", false, "Preview + approval every time"],
                ["Run commands", false, "Disabled by default"],
              ].map(([label, on, hint]) => (
                <div key={String(label)} className="final-row">
                  <span>
                    <strong>{label as string}</strong>
                    <small>{hint as string}</small>
                  </span>
                  <span className={`final-switch${on ? " is-on" : ""}`} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </>
    );
  }

  // Central approval queue (52)
  if (isPending) {
    return (
      <>
        <Header
          item={item}
          actions={<button className="final-btn">Clear queue</button>}
        />
        <p className="final-lede">
          3 write actions are waiting for your approval. Nothing is committed until you review each one.
        </p>
        <div className="final-stack">
          {[
            ["Update roadmap.md", "Agent-native Workflows run", "5m ago", "3 files"],
            ["Add examples to callout.mdx", "Docs polish run", "12m ago", "1 file"],
            ["Rewrite eval framework intro", "Evaluation run", "1h ago", "2 files"],
          ].map(([title, run, when, size]) => (
            <div key={title} className="final-card final-row">
              <span>
                <strong>{title}</strong>
                <small>
                  From {run} · {when} · {size}
                </small>
              </span>
              <div className="final-actions">
                <button className="final-btn">Reject</button>
                <button className="final-btn final-btn-primary">Review</button>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  // Tool call popover / detail (50)
  if (isTool) {
    return (
      <>
        <Header item={item} />
        <div className="final-two">
          <Card title="search_library · call #4">
            <div className="final-stack compact">
              <div>
                <strong>Input</strong>
                <pre className="final-code-block">{`{
  "query": "approval boundary",
  "kind": "documents",
  "limit": 5
}`}</pre>
              </div>
              <div>
                <strong>Result</strong>
                <pre className="final-code-block">{`5 matches (in 42 ms)
- Agent-native Workflows.mdx  #approval  ★ 0.94
- Evaluation Framework.mdx    #approval  ★ 0.88
- Design Principles.mdx       #approval  ★ 0.81
- Product Strategy 2025.md    #approval  ★ 0.72
- Multi-source RAG Notes.md   #approval  ★ 0.65`}</pre>
              </div>
              <div className="final-row">
                <span>
                  <strong>Duration</strong>
                  <small>42 ms · single provider</small>
                </span>
                <span className="final-pill is-synced">OK</span>
              </div>
            </div>
          </Card>
          <Card title="Where this ran">
            <div className="final-stack compact">
              <div>Run: Summarize approval boundary</div>
              <div>Model: GPT-5.5 · medium</div>
              <div>Started: 12:04:18</div>
              <div>Completed: 12:04:18.042</div>
            </div>
          </Card>
        </div>
      </>
    );
  }

  // Partial completion (55)
  if (isPartial) {
    return (
      <>
        <Header item={item} />
        <div className="final-two">
          <Card title="Run finished with partial results">
            <p className="final-lede">
              The agent completed 3 of 5 planned steps before hitting a tool timeout. Nothing was written.
            </p>
            <div className="final-stack compact">
              {[
                ["Gather context", "Complete"],
                ["Search files", "Complete"],
                ["Call tools", "Complete"],
                ["Draft answer", "Timed out"],
                ["Apply approved changes", "Skipped"],
              ].map(([step, status]) => (
                <div key={step} className="final-row">
                  <span>
                    <strong>{step}</strong>
                    <small>{status}</small>
                  </span>
                  <span className={`final-pill is-${status === "Complete" ? "synced" : status === "Timed out" ? "error" : "pending"}`}>
                    {status}
                  </span>
                </div>
              ))}
            </div>
            <div className="final-actions right">
              <button className="final-btn">Discard run</button>
              <button className="final-btn final-btn-primary">Retry from step 4</button>
            </div>
          </Card>
          <Card title="What we got">
            <p>Three grounded citations and a partial draft. Available even without retrying.</p>
            <div className="final-stack compact">
              <div>Agent-native Workflows.mdx §3</div>
              <div>Evaluation Framework.mdx §1</div>
              <div>Design Principles.mdx §5</div>
            </div>
          </Card>
        </div>
      </>
    );
  }

  // Change applied / undo (56)
  if (isApplied) {
    return (
      <>
        <Header item={item} />
        <div className="final-two">
          <Card title="Changes applied">
            <p className="final-lede">
              2 files updated. Everything is reversible — undo restores the previous state exactly.
            </p>
            <div className="final-stack compact">
              <div className="final-row">
                <span>
                  <strong>agent-native-workflows.mdx</strong>
                  <small>+14 lines · Monitoring section rewritten</small>
                </span>
                <span className="final-pill is-synced">Applied</span>
              </div>
              <div className="final-row">
                <span>
                  <strong>evaluation-framework.mdx</strong>
                  <small>+3 lines · Success criteria added</small>
                </span>
                <span className="final-pill is-synced">Applied</span>
              </div>
            </div>
            <div className="final-actions right">
              <button className="final-btn">Undo</button>
              <button className="final-btn final-btn-primary">Open first file</button>
            </div>
          </Card>
          <Card title="Provenance">
            <div className="final-stack compact">
              <div>Approved by Alex Chen · 12:07:41</div>
              <div>Model: GPT-5.5 · medium</div>
              <div>Sources cited: 5</div>
              <div>Local snapshot: kept for 30 days</div>
            </div>
          </Card>
        </div>
      </>
    );
  }

  // Blocked / no API key (54)
  if (item.id.includes("no-api-key")) {
    return (
      <>
        <Header item={item} />
        <div className="final-state-layout">
          <div className="final-state-card">
            <span className="final-state-icon">!</span>
            <h2>No AI provider connected</h2>
            <p>
              Reading, editing, search and library features still work. Ask AI and agent runs require a
              provider — pick one to enable them.
            </p>
            <div className="final-actions">
              <button className="final-btn">Learn about privacy</button>
              <button className="final-btn final-btn-primary">Connect a provider</button>
            </div>
          </div>
          <Card title="Still available">
            <div className="final-stack compact">
              {["Read documents", "Search library", "Edit MDX", "Manage sources", "Settings"].map((row) => (
                <div key={row} className="final-row">
                  <span>
                    <strong>{row}</strong>
                    <small>No provider required</small>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </>
    );
  }

  // Provider unavailable (53) - default error branch
  // Approval / changes-preview (06, 51) - default approval branch
  // Chat default (05) / running (49) - default agent shell
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
          <div className={`final-bubble is-agent${isError ? " is-error" : ""}`}>
            {isError
              ? "The selected provider is unavailable. Non-AI reading and editing stay available."
              : "Here are the grounded principles with cited sources and reversible next actions."}
          </div>
          {isApproval ? <ApprovalPreview /> : isRunning ? <RunTimeline item={item} /> : <RunTimeline item={item} />}
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

  // Wizard step tabs (Overview / Connect / Configure / Select Content / Sync / Done)
  const stepIdx = item.id.includes("choose")
    ? 0
    : item.id.includes("connect")
      ? 1
      : item.id.includes("configure")
        ? 2
        : item.id.includes("select-content")
          ? 3
          : item.id.includes("sync") || item.id.includes("syncing")
            ? 4
            : item.id.includes("complete")
              ? 5
              : 0;

  // Per-step bespoke content
  if (item.id === "59_add-source-choose") {
    return (
      <>
        <Header
          item={item}
          actions={<button className="final-btn final-btn-primary">Add Source</button>}
        />
        <Tabs
          labels={["Choose", "Connect", "Configure", "Select Content", "Sync", "Done"]}
          active={stepIdx}
        />
        <p className="final-lede">Pick where Verto should read documents from. You can add more sources later.</p>
        <div className="final-card-grid">
          {[
            ["Local Folder", "Read `.mdx` / `.md` from a folder on disk."],
            ["GitHub", "Public or private repo. Uses your GitHub sign-in."],
            ["OneDrive", "Share URL or private OAuth-connected drive."],
            ["Web / RSS", "Subscribe to RSS or article feeds."],
            ["Import Files", "One-off upload of .zip / .epub."],
            ["Notion", "Pages and databases from a Notion workspace."],
          ].map(([name, desc]) => (
            <Card key={name}>
              <h2>{name}</h2>
              <p>{desc}</p>
              <button className="final-btn">Select</button>
            </Card>
          ))}
        </div>
      </>
    );
  }

  if (item.id === "60_add-source-connect") {
    return (
      <>
        <Header
          item={item}
          actions={<button className="final-btn final-btn-primary">Add Source</button>}
        />
        <Tabs
          labels={["Choose", "Connect", "Configure", "Select Content", "Sync", "Done"]}
          active={stepIdx}
        />
        <div className="final-two">
          <Card title="Connect GitHub">
            <p className="final-lede">
              Verto will read your repositories via GitHub OAuth. We request only <code>repo</code> read
              and <code>read:user</code>.
            </p>
            <div className="final-stack compact">
              <div className="final-row">
                <span>
                  <strong>Read your repositories</strong>
                  <small>Public and private, no writes without approval</small>
                </span>
                <span className="final-pill">Required</span>
              </div>
              <div className="final-row">
                <span>
                  <strong>Read your profile</strong>
                  <small>Handle + avatar only</small>
                </span>
                <span className="final-pill">Required</span>
              </div>
            </div>
            <div className="final-actions right">
              <button className="final-btn">Cancel</button>
              <button className="final-btn final-btn-primary">Continue with GitHub</button>
            </div>
          </Card>
          <Card title="Permissions we won't request">
            <div className="final-stack compact">
              <div>Write access to your repositories</div>
              <div>Access to organizations you haven't approved</div>
              <div>Anything beyond the two scopes above</div>
            </div>
          </Card>
        </div>
      </>
    );
  }

  if (item.id === "61_add-source-configure") {
    return (
      <>
        <Header
          item={item}
          actions={<button className="final-btn final-btn-primary">Add Source</button>}
        />
        <Tabs
          labels={["Choose", "Connect", "Configure", "Select Content", "Sync", "Done"]}
          active={stepIdx}
        />
        <div className="final-two">
          <Card title="GitHub Configuration">
            <div className="final-stack compact">
              <label className="final-ref-field">
                <span>Repository</span>
                <div className="final-ref-input">tsaiggo/verto-handbook</div>
              </label>
              <label className="final-ref-field">
                <span>Branch</span>
                <div className="final-ref-input">main</div>
              </label>
              <label className="final-ref-field">
                <span>Content path</span>
                <div className="final-ref-input">content</div>
              </label>
              <label className="final-ref-field">
                <span>Include patterns</span>
                <div className="final-ref-input">*.md, *.mdx</div>
              </label>
              <label className="final-ref-field">
                <span>Exclude patterns</span>
                <div className="final-ref-input">drafts/**, .obsidian/**</div>
              </label>
            </div>
            <div className="final-actions right">
              <button className="final-btn final-btn-primary">Continue</button>
            </div>
          </Card>
          <Card title="Import preview">
            <div className="final-stack compact">
              <div className="final-row">
                <span>
                  <strong>docs/</strong>
                  <small>48 documents</small>
                </span>
                <span>2.4 MB</span>
              </div>
              <div className="final-row">
                <span>
                  <strong>notes/</strong>
                  <small>96 documents</small>
                </span>
                <span>1.1 MB</span>
              </div>
              <div className="final-row">
                <span>
                  <strong>guides/</strong>
                  <small>26 documents</small>
                </span>
                <span>820 KB</span>
              </div>
              <div className="final-row">
                <span>
                  <strong>components/</strong>
                  <small>16 documents</small>
                </span>
                <span>360 KB</span>
              </div>
            </div>
          </Card>
        </div>
      </>
    );
  }

  if (item.id === "62_add-source-select-content") {
    return (
      <>
        <Header
          item={item}
          actions={<button className="final-btn final-btn-primary">Add Source</button>}
        />
        <Tabs
          labels={["Choose", "Connect", "Configure", "Select Content", "Sync", "Done"]}
          active={stepIdx}
        />
        <div className="final-two">
          <Card title="Select folders">
            <div className="final-stack compact">
              {[
                ["✓ docs/", "48 documents · 2.4 MB"],
                ["✓ notes/", "96 documents · 1.1 MB"],
                ["○ guides/", "26 documents · 820 KB"],
                ["✓ components/", "16 documents · 360 KB"],
                ["○ drafts/", "8 documents · excluded"],
              ].map(([label, meta]) => (
                <div key={label} className="final-row">
                  <span>
                    <strong>{label}</strong>
                    <small>{meta}</small>
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Estimated import">
            <div className="final-stack compact">
              <div>
                <strong>160 documents</strong>
                <small> · 3.9 MB total</small>
              </div>
              <div>
                <strong>~24 seconds</strong>
                <small> initial sync</small>
              </div>
              <div>
                <strong>Local index</strong>
                <small> stays on this device</small>
              </div>
            </div>
            <div className="final-actions right">
              <button className="final-btn final-btn-primary">Start Sync</button>
            </div>
          </Card>
        </div>
      </>
    );
  }

  if (item.id === "63_add-source-initial-sync") {
    return (
      <>
        <Header
          item={item}
          actions={<button className="final-btn">Continue in background</button>}
        />
        <Tabs
          labels={["Choose", "Connect", "Configure", "Select Content", "Sync", "Done"]}
          active={stepIdx}
        />
        <Card title="Initial sync in progress">
          <p className="final-lede">Reading files, indexing headings, extracting tags and links.</p>
          <div className="final-progress">
            <span style={{ width: "62%" }} />
          </div>
          <div className="final-stack compact">
            <div className="final-row">
              <span>
                <strong>Fetching content</strong>
                <small>docs/, notes/, components/</small>
              </span>
              <span className="final-pill is-synced">Done</span>
            </div>
            <div className="final-row">
              <span>
                <strong>Building index</strong>
                <small>Headings, tags, wikilinks</small>
              </span>
              <span className="final-pill is-pending">Running</span>
            </div>
            <div className="final-row">
              <span>
                <strong>Computing summaries</strong>
                <small>Optional · runs after index</small>
              </span>
              <span className="final-pill">Queued</span>
            </div>
          </div>
        </Card>
      </>
    );
  }

  if (item.id === "64_add-source-complete") {
    return (
      <>
        <Header item={item} />
        <Tabs
          labels={["Choose", "Connect", "Configure", "Select Content", "Sync", "Done"]}
          active={stepIdx}
        />
        <div className="final-two">
          <Card title="Source connected">
            <p className="final-lede">tsaiggo/verto-handbook is indexed and ready.</p>
            <div className="final-stack compact">
              <div className="final-row">
                <span>
                  <strong>160 documents</strong>
                  <small>Indexed and searchable</small>
                </span>
                <span className="final-pill is-synced">Synced</span>
              </div>
              <div className="final-row">
                <span>
                  <strong>1,842 tags</strong>
                  <small>Extracted and grouped</small>
                </span>
                <span className="final-pill is-synced">Ready</span>
              </div>
              <div className="final-row">
                <span>
                  <strong>324 backlinks</strong>
                  <small>Resolved across the corpus</small>
                </span>
                <span className="final-pill is-synced">Ready</span>
              </div>
            </div>
            <div className="final-actions right">
              <button className="final-btn">Add another source</button>
              <button className="final-btn final-btn-primary">Open library</button>
            </div>
          </Card>
          <Card title="Next steps">
            <div className="final-stack compact">
              <div>Open a document · /read</div>
              <div>Browse the library · /library</div>
              <div>Try the agent · /agent</div>
            </div>
          </Card>
        </div>
      </>
    );
  }

  if (item.id === "65_source-detail") {
    return (
      <>
        <Header
          item={item}
          actions={
            <>
              <button className="final-btn">Reindex</button>
              <button className="final-btn">Settings</button>
            </>
          }
        />
        <div className="final-two">
          <Card title="tsaiggo/verto-handbook">
            <div className="final-stack compact">
              <div className="final-row">
                <span>
                  <strong>Type</strong>
                  <small>GitHub · main branch</small>
                </span>
                <span className="final-pill is-synced">Synced</span>
              </div>
              <div className="final-row">
                <span>
                  <strong>Documents</strong>
                  <small>160 files · 3.9 MB</small>
                </span>
                <span>160</span>
              </div>
              <div className="final-row">
                <span>
                  <strong>Last synced</strong>
                  <small>3 minutes ago</small>
                </span>
                <span className="final-pill is-synced">Fresh</span>
              </div>
            </div>
          </Card>
          <Card title="Sync history">
            <div className="final-stack compact">
              {[
                ["3m ago", "Incremental · 4 changes"],
                ["1h ago", "Incremental · 12 changes"],
                ["Yesterday 18:04", "Full sync · 160 files"],
                ["2d ago", "Incremental · 3 changes"],
              ].map(([when, what]) => (
                <div key={when} className="final-row">
                  <span>
                    <strong>{when}</strong>
                    <small>{what}</small>
                  </span>
                  <span className="final-pill is-synced">OK</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </>
    );
  }

  if (item.id === "66_source-health") {
    return (
      <>
        <Header item={item} />
        <div className="final-two">
          <Card title="Storage per source">
            <div className="final-stack compact">
              {[
                ["Local Folder", "1.4 GB", "68%"],
                ["GitHub · verto-handbook", "3.9 MB", "12%"],
                ["OneDrive · Personal", "82 MB", "9%"],
                ["Web / RSS", "18 MB", "6%"],
                ["Imported files", "24 MB", "5%"],
              ].map(([name, size, pct]) => (
                <div key={name} className="final-row">
                  <span>
                    <strong>{name}</strong>
                    <small>{size}</small>
                  </span>
                  <span className="final-pill">{pct}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Sync health">
            <div className="final-stack compact">
              <div className="final-row">
                <span>
                  <strong>All sources</strong>
                  <small>5 healthy · 1 syncing · 0 errors</small>
                </span>
                <span className="final-pill is-synced">OK</span>
              </div>
              <div className="final-row">
                <span>
                  <strong>Index freshness</strong>
                  <small>Last full sweep 3 minutes ago</small>
                </span>
                <span className="final-pill is-synced">Fresh</span>
              </div>
              <div className="final-row">
                <span>
                  <strong>Storage remaining</strong>
                  <small>18 GB free on this device</small>
                </span>
                <span className="final-pill">OK</span>
              </div>
            </div>
          </Card>
        </div>
      </>
    );
  }

  // Default: sources overview (07 / 58) — existing table
  return (
    <>
      <Header
        item={item}
        actions={<button className="final-btn final-btn-primary">Add Source</button>}
      />
      <Tabs labels={["All Sources", "Connected", "Disconnected"]} active={0} />
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
  if (item.id === "21_design-tokens") {
    return (
      <>
        <Header item={item} />
        <div className="final-card-grid">
          <Card title="Color tokens">
            <p>Neutral base + minimal semantic accents. Hex → CSS variable.</p>
            <div className="final-token-row">
              <span style={{ background: "#fafafa", border: "1px solid #e6e6e2" }} />
              <span style={{ background: "#ffffff", border: "1px solid #e6e6e2" }} />
              <span style={{ background: "#f5f5f3" }} />
              <span style={{ background: "#0f1115" }} />
              <span style={{ background: "#6b6f76" }} />
              <span style={{ background: "#2563eb" }} />
              <span style={{ background: "#16a34a" }} />
              <span style={{ background: "#dc2626" }} />
            </div>
            <small>bg · surface · subtle · text · muted · accent · success · error</small>
          </Card>
          <Card title="Typography">
            <p>Inter (sans) + JetBrains Mono (mono). No decorative faces.</p>
            <div className="final-stack compact">
              <div style={{ fontSize: 22, fontWeight: 700 }}>H1 · 22 / 700</div>
              <div style={{ fontSize: 16, fontWeight: 650 }}>H2 · 16 / 650</div>
              <div style={{ fontSize: 13, color: "#6b6f76" }}>Body · 13 / 400 · muted</div>
              <div style={{ fontSize: 12, fontFamily: "ui-monospace, monospace" }}>
                Mono · 12 · JetBrains
              </div>
            </div>
          </Card>
          <Card title="Spacing scale">
            <div className="final-stack compact">
              <div>4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64</div>
              <small>Every gap/padding rounds to nearest scale value.</small>
            </div>
          </Card>
          <Card title="Radius scale">
            <div className="final-stack compact">
              <div>0 · 2 · 4 · 6 · 8 · 12 · 18 · 24 · 999 (pill)</div>
              <small>Pills use 999px. No large numeric radii.</small>
            </div>
          </Card>
          <Card title="Elevation">
            <p>Flat by design. 1px border is the elevation.</p>
            <small>Cards: outline only · Modals/popovers: soft shadow allowed</small>
          </Card>
          <Card title="Desktop panels">
            <div className="final-stack compact">
              <div>Primary nav · 64</div>
              <div>Sources rail · 240–280</div>
              <div>Document tree · 280–340</div>
              <div>Context rail · 320–360</div>
              <div>Top bar · 56 · Status bar · 28</div>
            </div>
          </Card>
        </div>
      </>
    );
  }

  if (item.id === "22_component-library") {
    return (
      <>
        <Header item={item} />
        <div className="final-card-grid">
          <Card title="Buttons">
            <div className="final-actions">
              <button type="button" className="final-btn final-btn-primary">
                Primary
              </button>
              <button type="button" className="final-btn">
                Secondary
              </button>
              <button type="button" className="final-btn" disabled>
                Disabled
              </button>
            </div>
          </Card>
          <Card title="Pills / tags">
            <div className="final-actions">
              <span className="final-pill">Default</span>
              <span className="final-pill is-synced">Synced</span>
              <span className="final-pill is-error">Error</span>
              <span className="final-pill is-pending">Pending</span>
            </div>
          </Card>
          <Card title="Inputs">
            <div className="final-stack compact">
              <div className="final-ref-input">Enter text…</div>
              <div className="final-ref-input">github.com/owner/repo</div>
            </div>
          </Card>
          <Card title="Cards">
            <p className="final-lede">A 1px bordered surface holds one primary content chunk.</p>
            <small>Section title, divider, body, optional footer actions.</small>
          </Card>
          <Card title="Tabs">
            <Tabs labels={["Read", "Edit", "Split"]} active={1} />
          </Card>
          <Card title="Status">
            <div className="final-stack compact">
              <div className="final-row">
                <span>
                  <strong>Success</strong>
                  <small>Change applied</small>
                </span>
                <span className="final-pill is-synced">OK</span>
              </div>
              <div className="final-row">
                <span>
                  <strong>Warning</strong>
                  <small>Large file</small>
                </span>
                <span className="final-pill is-pending">Wait</span>
              </div>
              <div className="final-row">
                <span>
                  <strong>Error</strong>
                  <small>Sync failed</small>
                </span>
                <span className="final-pill is-error">Fail</span>
              </div>
            </div>
          </Card>
        </div>
      </>
    );
  }

  if (item.id === "23_app-shell-anatomy") {
    return (
      <>
        <Header item={item} />
        <div className="final-two">
          <Card title="Desktop shell regions">
            <div className="final-stack">
              {[
                ["Primary nav", "64px · icon-only rail"],
                ["Sources rail", "240–280px · contextual"],
                ["Document tree", "280–340px · file tree"],
                ["Context rail", "320–360px · Outline / Notes / Links / Agent"],
                ["Top bar", "56px · search + user"],
                ["Status bar", "28px · optional footer"],
              ].map(([label, meta]) => (
                <div key={label} className="final-row">
                  <span>
                    <strong>{label}</strong>
                    <small>{meta}</small>
                  </span>
                  <span className="final-pill">Fixed</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Rules">
            <div className="final-stack compact">
              <div>Primary nav is always visible.</div>
              <div>The document is the primary visual object.</div>
              <div>Context rail order is fixed: Outline / Notes / Links / Agent.</div>
              <div>Top bar never stacks multiple rows.</div>
              <div>Modes are Read / Edit / Split only.</div>
            </div>
          </Card>
        </div>
      </>
    );
  }

  // 00_design-system-reference (or fallback for other Foundation IDs)
  return (
    <>
      <Header item={item} />
      <div className="final-card-grid">
        <Card title="Color tokens">
          <div className="final-token-row">
            <span style={{ background: "#fafafa", border: "1px solid #e6e6e2" }} />
            <span style={{ background: "#ffffff", border: "1px solid #e6e6e2" }} />
            <span style={{ background: "#f5f5f3" }} />
            <span style={{ background: "#0f1115" }} />
            <span style={{ background: "#6b6f76" }} />
            <span style={{ background: "#2563eb" }} />
            <span style={{ background: "#16a34a" }} />
          </div>
          <small>bg · surface · subtle · text · muted · accent · success</small>
        </Card>
        <Card title="Typography">
          <div className="final-stack compact">
            <div style={{ fontSize: 20, fontWeight: 700 }}>Display · 20 / 700</div>
            <div style={{ fontSize: 15, fontWeight: 650 }}>Section · 15 / 650</div>
            <div style={{ fontSize: 13, color: "#6b6f76" }}>Body · 13 · muted</div>
          </div>
        </Card>
        <Card title="Buttons">
          <div className="final-actions">
            <button type="button" className="final-btn final-btn-primary">
              Primary
            </button>
            <button type="button" className="final-btn">
              Secondary
            </button>
          </div>
        </Card>
        <Card title="Cards & states">
          <p className="final-lede">A neutral surface with a thin border. No shadow-based elevation.</p>
          <div className="final-actions">
            <span className="final-pill is-synced">Synced</span>
            <span className="final-pill is-pending">Pending</span>
            <span className="final-pill is-error">Error</span>
          </div>
        </Card>
        <Card title="Foundations">
          <div className="final-stack compact">
            <div>Spacing: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64</div>
            <div>Radius: 0 · 2 · 4 · 6 · 8 · 12 · 18 · 24</div>
            <div>Elevation: flat (1px border)</div>
          </div>
        </Card>
        <Card title="Component library">
          <div className="final-stack compact">
            <div>Cards · Buttons · Pills · Inputs · Tabs</div>
            <div>Search prompt · Toggle · Diff row</div>
            <div>Heatmap cell · Stat card · Result row</div>
          </div>
        </Card>
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
