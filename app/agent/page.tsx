import AgentWorkspace, { type AgentSource } from "@/components/agent/AgentWorkspace";
import { listAllFiles } from "@/lib/content-source";
import { getAssistantConfig } from "@/lib/ai/index";

export const metadata = {
  title: "Agent",
  description: "Chat with an agent grounded in your knowledge.",
};

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

  const sources: AgentSource[] = visible.slice(0, 6).map((file, i) => ({
    title: `${file.title}${file.ext}`,
    subtitle: CONTEXT_HINTS[i % CONTEXT_HINTS.length],
    href: file.href,
  }));

  const { kind } = getAssistantConfig();

  return <AgentWorkspace sources={sources} assistantKind={kind} />;
}
