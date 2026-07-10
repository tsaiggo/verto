// /final product surfaces: agent workflows.
import type { FinalPackItem } from "@/components/final/final-pack-data";
import { Card, Header } from "@/components/final/final-primitives";

function AgentPermissionsBoard({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header item={item} />
      <div className="final-two">
        <Card title="Model & permissions">
          <div className="final-stack compact">
            {[
              ["Model", "GPT-5.5", "medium"],
              ["Provider", "Configured assistant", "connected"],
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

function AgentPendingApprovalsBoard({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header item={item} actions={<button className="final-btn">Clear queue</button>} />
      <p className="final-lede">
        3 write actions are waiting for your approval. Nothing is committed until you review each
        one.
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

function AgentToolCallBoard({ item }: { item: FinalPackItem }) {
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

function AgentPartialBoard({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header item={item} />
      <div className="final-two">
        <Card title="Run finished with partial results">
          <p className="final-lede">
            The agent completed 3 of 5 planned steps before hitting a tool timeout. Nothing was
            written.
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
                <span
                  className={`final-pill is-${status === "Complete" ? "synced" : status === "Timed out" ? "error" : "pending"}`}
                >
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

function AgentAppliedBoard({ item }: { item: FinalPackItem }) {
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

function AgentNoProviderBoard({ item }: { item: FinalPackItem }) {
  return (
    <>
      <Header item={item} />
      <div className="final-state-layout">
        <div className="final-state-card">
          <span className="final-state-icon">!</span>
          <h2>No AI provider connected</h2>
          <p>
            Reading, editing, search and library features still work. Ask AI and agent runs require
            a provider — pick one to enable them.
          </p>
          <div className="final-actions">
            <button className="final-btn">Learn about privacy</button>
            <button className="final-btn final-btn-primary">Connect a provider</button>
          </div>
        </div>
        <Card title="Still available">
          <div className="final-stack compact">
            {["Read documents", "Search library", "Edit MDX", "Manage sources", "Settings"].map(
              (row) => (
                <div key={row} className="final-row">
                  <span>
                    <strong>{row}</strong>
                    <small>No provider required</small>
                  </span>
                </div>
              )
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function AgentChatBoard({ item }: { item: FinalPackItem }) {
  const isError = item.state === "Error" || item.state === "Blocked";
  const isApproval =
    item.state.includes("Approval") || item.id.includes("approval") || item.id.includes("changes");
  const isRunning = item.id.includes("run-in-progress");
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
          {isApproval ? (
            <ApprovalPreview />
          ) : isRunning ? (
            <RunTimeline item={item} />
          ) : (
            <RunTimeline item={item} />
          )}
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

export function AgentSurface({ item }: { item: FinalPackItem }) {
  if (item.id.includes("permissions")) return <AgentPermissionsBoard item={item} />;
  if (item.id.includes("pending-approvals")) return <AgentPendingApprovalsBoard item={item} />;
  if (item.id.includes("tool-call")) return <AgentToolCallBoard item={item} />;
  if (item.id.includes("partial")) return <AgentPartialBoard item={item} />;
  if (item.id.includes("applied")) return <AgentAppliedBoard item={item} />;
  if (item.id.includes("no-api-key")) return <AgentNoProviderBoard item={item} />;
  return <AgentChatBoard item={item} />;
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
