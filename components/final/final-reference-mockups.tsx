// /final reference mockups: mini library, responsive devices, dark reader, home dashboard.
import type { ReactNode } from "react";
import type { FinalPackItem } from "@/components/final/final-pack-data";
import { ReferenceShell, ReferenceStage } from "@/components/final/final-primitives";

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

export function ResponsiveDeviceSurface({ item }: { item: FinalPackItem }) {
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

export function DarkReaderSurface() {
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

export function HomeReferenceContent({ overlay }: { overlay?: ReactNode }) {
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
