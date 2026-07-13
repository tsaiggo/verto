import AgentWorkspace, { type AgentSource } from "@/components/agent/AgentWorkspace";
import { listAllFiles, readFileNodeSource } from "@/lib/content-source";
import { getAssistantConfig } from "@/lib/ai/index";

export const metadata = {
  title: "Agent",
  description: "Chat with an agent grounded in your knowledge.",
};

const MAX_ATTACHED_SOURCES = 48;

function sourceSubtitle(file: Awaited<ReturnType<typeof listAllFiles>>[number]): string {
  const location = file.slug.length > 1 ? file.slug.slice(0, -1).join(" / ") : "Workspace";
  const tags = file.tags?.length ? file.tags.map((tag) => `#${tag}`).join(" ") : "No tags";
  return `${location} · ${tags}`;
}

export default async function AgentPage() {
  const files = await listAllFiles();
  const visible = files.filter((f) => !f.hidden && !f.draft);
  const loaded = await Promise.all(
    visible.slice(0, MAX_ATTACHED_SOURCES).map(async (file) => {
      try {
        const body = await readFileNodeSource(file);
        if (!body.trim()) return null;
        const source: AgentSource = {
          title: file.title,
          subtitle: sourceSubtitle(file),
          href: file.href,
          body,
          tags: file.tags ?? [],
        };
        return source;
      } catch {
        // An unreadable document is not valid Agent context. Omitting it is
        // safer than listing a source the retrieval tools cannot inspect.
        return null;
      }
    })
  );
  const sources = loaded.filter((source): source is AgentSource => source !== null);

  const { kind, model } = getAssistantConfig();

  return <AgentWorkspace sources={sources} assistantKind={kind} assistantModel={model} />;
}
