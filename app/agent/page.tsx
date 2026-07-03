import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  FileText,
  History,
  MessageSquarePlus,
  MoreHorizontal,
  Paperclip,
  PanelRight,
  Plus,
  SendHorizontal,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import HeaderActions from "@/components/layout/HeaderActions";

export const metadata = { title: "Agent" };

const HISTORY: { group: string; items: string[] }[] = [
  {
    group: "Today",
    items: [
      "Summarize agent-native workflows",
      "Compare RAG vs fine-tuning",
      "How does Verto ensure source ci…",
    ],
  },
  { group: "Yesterday", items: ["Design principles summary"] },
  { group: "This week", items: ["Onboard a new data source", "Past meeting follow-ups"] },
];

const PRINCIPLES = [
  {
    title: "Context is everything",
    body: "Agents are only as good as the context they operate on. Provide the right context, in the right format, at the right time.",
    source: "Agent-native Workflows.md",
  },
  {
    title: "Tools, not steps",
    body: "Design workflows as a set of tools the agent can use, not a rigid sequence of steps.",
    source: "Agent-native Workflows.md",
  },
  {
    title: "Observe and adapt",
    body: "Agents should evaluate outcomes, learn from feedback, and adapt their approach.",
    source: "Key Features.md",
  },
  {
    title: "Human in the loop",
    body: "Keep humans in control of intent and guardrails, while delegating execution to agents.",
    source: "Agent-native Workflows.md",
  },
];

const SOURCES = [
  { title: "Agent-native Workflows.md", note: "Section 3 · Core Principles" },
  { title: "Key Features.md", note: "Suggested related content" },
  { title: "AI in Product Design.md", note: "Yesterday" },
  { title: "Designing AI Products.md", note: "Linked 3 related notes" },
  { title: "Multi-source RAG Notes.md", note: "Yesterday" },
];

const FOLLOWUPS = [
  "How do tools differ from steps in practice?",
  "Show examples of agent-native workflows",
  "How does Verto support human in the loop?",
];

export default function AgentPage() {
  return (
    <div className="agent">
      <header className="agent-topbar">
        <div className="agent-topbar-left">
          <Link href="/" className="agent-back" aria-label="Back">
            <ArrowLeft aria-hidden />
          </Link>
          <span className="agent-title">Agent Chat</span>
          <span className="agent-sub">· With Sources</span>
        </div>
        <div className="agent-topbar-right">
          <button type="button" className="v-icon-btn" aria-label="History">
            <History aria-hidden />
          </button>
          <button type="button" className="v-icon-btn" aria-label="Toggle context">
            <PanelRight aria-hidden />
          </button>
          <HeaderActions />
        </div>
      </header>

      <div className="agent-body">
        <aside className="agent-history">
          <button type="button" className="v-btn agent-new">
            <MessageSquarePlus aria-hidden /> New Chat
          </button>
          {HISTORY.map((section) => (
            <div key={section.group} className="agent-hist-group">
              <span className="agent-hist-label">{section.group}</span>
              {section.items.map((item, i) => (
                <button
                  key={item}
                  type="button"
                  className={`agent-hist-item${section.group === "Today" && i === 0 ? " is-active" : ""}`}
                >
                  {item}
                </button>
              ))}
            </div>
          ))}
          <button type="button" className="agent-clear">
            <Trash2 aria-hidden /> Clear conversations
          </button>
        </aside>

        <main className="agent-thread">
          <div className="agent-scroll">
            <div className="agent-msg agent-msg--user">
              <div className="agent-bubble">
                What are the core principles behind agent-native workflows?
              </div>
            </div>

            <div className="agent-msg agent-msg--ai">
              <span className="agent-avatar" aria-hidden>
                <Sparkles />
              </span>
              <div className="agent-answer">
                <p>
                  Here are the core principles of agent-native workflows as outlined in your
                  library.
                </p>
                <ol className="agent-principles">
                  {PRINCIPLES.map((p, i) => (
                    <li key={p.title}>
                      <span className="agent-principle-title">{p.title}</span>
                      <span className="agent-principle-body">{p.body}</span>
                      <span className="agent-cite">
                        <span className="agent-cite-num">{i + 1}</span>
                        <FileText aria-hidden />
                        {p.source}
                      </span>
                    </li>
                  ))}
                </ol>
                <p>
                  These principles work together to create workflows that are flexible, reliable,
                  and continuously improving.
                </p>
                <div className="agent-msg-actions">
                  <button type="button" aria-label="Copy">
                    <Copy aria-hidden />
                  </button>
                  <button type="button" aria-label="Good response">
                    <ThumbsUp aria-hidden />
                  </button>
                  <button type="button" aria-label="Bad response">
                    <ThumbsDown aria-hidden />
                  </button>
                  <button type="button" aria-label="More">
                    <MoreHorizontal aria-hidden />
                  </button>
                </div>
              </div>
            </div>

            <div className="agent-followups">
              <span className="agent-followups-label">
                Suggested follow-ups <ArrowRight aria-hidden />
              </span>
              <div className="agent-followups-row">
                {FOLLOWUPS.map((f) => (
                  <button key={f} type="button" className="agent-chip">
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="agent-composer">
            <div className="agent-input">
              <textarea rows={1} placeholder="Ask anything about your knowledge…" />
              <div className="agent-input-foot">
                <button type="button" className="agent-input-btn" aria-label="Attach">
                  <Paperclip aria-hidden />
                </button>
                <kbd>⌘K</kbd>
                <div className="agent-input-spacer" />
                <span className="agent-web">
                  Web
                  <span className="agent-switch" aria-hidden />
                </span>
                <button type="button" className="agent-send" aria-label="Send">
                  <SendHorizontal aria-hidden />
                </button>
              </div>
            </div>
            <p className="agent-disclaimer">Verto can make mistakes. Check important info.</p>
          </div>
        </main>

        <aside className="agent-context">
          <div className="agent-context-head">
            <span className="agent-context-title">Context</span>
          </div>
          <div className="agent-context-sub">
            <span>Active sources</span>
            <span className="agent-count">6</span>
          </div>
          <ul className="agent-sources">
            {SOURCES.map((s) => (
              <li key={s.title} className="agent-source">
                <FileText className="agent-source-icon" aria-hidden />
                <span className="agent-source-body">
                  <span className="agent-source-title">{s.title}</span>
                  <span className="agent-source-note">{s.note}</span>
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="v-btn agent-add-sources">
            <Plus aria-hidden /> Add sources
          </button>

          <div className="v-card agent-grounding">
            <div className="agent-grounding-head">
              <span>Grounding</span>
              <span className="v-chip v-chip--success">Beta</span>
            </div>
            <p className="agent-grounding-text">All responses are grounded in your sources.</p>
            <span className="agent-grounding-bar" aria-hidden>
              <span style={{ width: "100%" }} />
            </span>
            <span className="agent-grounding-meta">6 / 6 sources used</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
