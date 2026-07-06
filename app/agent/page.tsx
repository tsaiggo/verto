import AgentWorkspace, {
  type AgentMessage,
  type AgentSource,
  type AgentThread,
} from "@/components/agent/AgentWorkspace";
import { listAllFiles } from "@/lib/content-source";
import { SAMPLE_DOCS } from "@/components/pages/sample";

export const metadata = {
  title: "Agent",
  description: "Chat with an agent grounded in your knowledge.",
};

const THREADS: AgentThread[] = [
  { id: "summarize", title: "Summarize agent-native workflows", group: "Today" },
  { id: "rag", title: "Compare RAG vs fine-tuning", group: "Today" },
  { id: "citations", title: "How does Verto ensure citations?", group: "Today" },
  { id: "principles", title: "Design principles summary", group: "Yesterday" },
];

const CONVERSATION: AgentMessage[] = [
  {
    id: "seed-user",
    role: "user",
    text: "What are the core principles behind agent-native workflows?",
  },
  {
    id: "seed-agent",
    role: "agent",
    text: "Here are the core principles as outlined in your library.",
    list: [
      {
        term: "Context is everything",
        text: "Provide the right context, in the right format, at the right time.",
      },
      {
        term: "Tools, not steps",
        text: "Give agents flexible tools rather than rigid workflows.",
      },
      {
        term: "Observe and adapt",
        text: "Evaluate outcomes and learn from feedback.",
      },
      {
        term: "Human in the loop",
        text: "Keep people in control of intent and guardrails.",
      },
    ],
    citations: [
      { index: 1, label: "Agent-native Workflows.mdx", href: "/read" },
      { index: 2, label: "Key Features.mdx", href: "/read" },
    ],
  },
];

const CONTEXT_HINTS = [
  "Section 3 · Core Principles",
  "Suggested related content",
  "Yesterday",
  "Linked notes",
  "Referenced in answer",
  "Recently opened",
];

export default async function AgentPage() {
  const files = await listAllFiles();
  const visible = files.filter((f) => !f.hidden && !f.draft);

  const sources: AgentSource[] =
    visible.length > 0
      ? visible.slice(0, 6).map((file, i) => ({
          title: `${file.title}${file.ext}`,
          subtitle: CONTEXT_HINTS[i % CONTEXT_HINTS.length],
          href: file.href,
        }))
      : SAMPLE_DOCS.slice(0, 6).map((doc, i) => ({
          title: doc.file,
          subtitle: CONTEXT_HINTS[i % CONTEXT_HINTS.length],
          href: doc.href,
        }));

  return (
    <AgentWorkspace
      threads={THREADS}
      activeThreadId="summarize"
      messages={CONVERSATION}
      sources={sources}
    />
  );
}
