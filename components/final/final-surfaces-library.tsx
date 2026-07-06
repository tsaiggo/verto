// /final product surfaces: library & knowledge, reader (+ related helper).
import Link from "next/link";
import { categoryItems, type FinalPackItem } from "@/components/final/final-pack-data";
import { cards } from "@/components/final/final-fixtures";
import { Card, Header, Tabs } from "@/components/final/final-primitives";

export function Related({ item }: { item: FinalPackItem }) {
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

export function KnowledgeSurface({ item }: { item: FinalPackItem }) {
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

export function ReaderSurface({ item }: { item: FinalPackItem }) {
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
