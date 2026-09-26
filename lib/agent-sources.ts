import { listAllFiles, readFileNodeSource } from "@/lib/content-source";
import type { AgentSource } from "@/components/agent/agent-types";

const MAX_ATTACHED_SOURCES = 48;

function sourceSubtitle(file: Awaited<ReturnType<typeof listAllFiles>>[number]): string {
  const location = file.slug.length > 1 ? file.slug.slice(0, -1).join(" / ") : "Workspace";
  const tags = file.tags?.length ? file.tags.map((tag) => `#${tag}`).join(" ") : "No tags";
  return `${location} · ${tags}`;
}

/** The same readable source set serves the full Agent view and its persistent pane. */
export async function loadAgentSources(): Promise<{
  sources: AgentSource[];
  availableSourceCount: number;
}> {
  const files = await listAllFiles();
  const visible = files.filter((file) => !file.hidden && !file.draft);
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
        // Unreadable files cannot be offered as grounded context.
        return null;
      }
    })
  );
  return {
    sources: loaded.filter((source): source is AgentSource => source !== null),
    availableSourceCount: visible.length,
  };
}
